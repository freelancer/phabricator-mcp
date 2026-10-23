import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import type { ConduitClient } from '../client/conduit.js';
import { registerAllTools } from './index.js';
import {
  TOOL_METHODS,
  applyConduitMethods,
  hideUnavailableTools,
  loadConduitMethods,
  methodCachePath,
  readMethodCache,
  recordTools,
  writeMethodCache,
} from './availability.js';

async function connect(server: McpServer) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientTransport);
  return client;
}

async function listed(client: Client) {
  const { tools } = await client.listTools();
  return tools.map((tool) => tool.name).sort();
}

async function toolNames(methods: ReadonlySet<string> | null) {
  const server = new McpServer({ name: 'test', version: '0' });
  const tools = registerAllTools(server, {} as ConduitClient);
  if (methods) {
    applyConduitMethods(tools, methods);
  }
  const client = await connect(server);
  const names = await listed(client);
  await client.close();
  return names;
}

const everyMethod = new Set(Object.values(TOOL_METHODS).flat());

function silenced<T>(run: () => Promise<T>): Promise<{ result: T; errors: string[] }> {
  const errors: string[] = [];
  const error = console.error;
  console.error = (message: string) => { errors.push(message); };
  return run().then((result) => ({ result, errors })).finally(() => { console.error = error; });
}

function methodsClient(methods: Iterable<string>, calls: string[] = []) {
  return {
    call: async (method: string) => {
      calls.push(method);
      return Object.fromEntries([...methods].map((name) => [name, {}]));
    },
  } as unknown as ConduitClient;
}

describe('tool availability', () => {
  it('lists the Conduit methods of every registered tool, and no others', async () => {
    assert.deepStrictEqual(await toolNames(null), Object.keys(TOOL_METHODS).sort());
  });

  it('lists every tool when the instance has all their methods', async () => {
    assert.deepStrictEqual(await toolNames(everyMethod), await toolNames(null));
  });

  it('hides tools whose methods the instance does not offer', async () => {
    const methods = new Set(everyMethod);
    for (const method of ['conpherence.edit', 'conpherence.querytransaction', 'phriction.document.edit']) {
      methods.delete(method);
    }
    const names = await toolNames(methods);
    for (const gone of ['phabricator_conpherence_create', 'phabricator_conpherence_edit', 'phabricator_conpherence_send', 'phabricator_conpherence_read', 'phabricator_document_add_comment']) {
      assert.ok(!names.includes(gone), `${gone} is still listed`);
    }
    assert.strictEqual(names.length, Object.keys(TOOL_METHODS).length - 5);
    assert.ok(names.includes('phabricator_document_edit'));
  });

  it('keeps a tool with a fallback method when only the fallback exists', async () => {
    const methods = new Set([...everyMethod].filter((method) => !method.startsWith('differential.inline.')));
    const names = await toolNames(methods);
    assert.ok(names.includes('phabricator_revision_inline_comment'));
    assert.ok(!names.includes('phabricator_revision_inline_search'));
    assert.ok(!names.includes('phabricator_revision_inline_edit'));
    assert.ok(!names.includes('phabricator_revision_inline_delete'));
  });

  it('always lists the version tool', async () => {
    assert.deepStrictEqual(await toolNames(new Set()), ['phabricator_version']);
  });
});

describe('loadConduitMethods', () => {
  it('returns the method names conduit.query lists', async () => {
    assert.deepStrictEqual(await loadConduitMethods(methodsClient(['conduit.query', 'user.whoami'])), new Set(['conduit.query', 'user.whoami']));
  });

  it('returns null when conduit.query fails, does not answer in time or returns no method list', async () => {
    const failing = { call: async () => { throw new Error('HTTP 500'); } } as unknown as ConduitClient;
    const empty = { call: async () => [] } as unknown as ConduitClient;
    let aborted = false;
    const hanging = {
      call: (_method: string, _params: unknown, { signal }: { signal: AbortSignal }) => new Promise((_, reject) => {
        // Stands in for the open socket of a real request, which keeps Node running.
        const socket = setTimeout(() => {}, 10_000);
        signal.addEventListener('abort', () => { clearTimeout(socket); aborted = true; reject(signal.reason); });
      }),
    } as unknown as ConduitClient;
    const { errors } = await silenced(async () => {
      assert.strictEqual(await loadConduitMethods(failing), null);
      assert.strictEqual(await loadConduitMethods(hanging, 50), null);
      assert.strictEqual(await loadConduitMethods(empty), null);
    });
    assert.ok(aborted, 'the timed-out request was not aborted');
    assert.deepStrictEqual(errors, [
      'phabricator-mcp: cannot list Conduit methods: HTTP 500',
      'phabricator-mcp: cannot list Conduit methods: no answer in 50ms',
      'phabricator-mcp: cannot list Conduit methods: conduit.query returned no method list',
    ]);
  });
});

describe('method cache', () => {
  it('is per URL and token, and does not contain the token', () => {
    const a = methodCachePath({ phabricatorUrl: 'https://a', apiToken: 'api-one' });
    assert.notStrictEqual(a, methodCachePath({ phabricatorUrl: 'https://a', apiToken: 'api-two' }));
    assert.notStrictEqual(a, methodCachePath({ phabricatorUrl: 'https://b', apiToken: 'api-one' }));
    assert.ok(!a.includes('api-one'));
  });

  it('reads back what it wrote, and nothing from a missing or bad file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'phab-mcp-'));
    const path = join(dir, 'sub', 'methods.json');
    assert.strictEqual(readMethodCache(path), null);
    writeMethodCache(path, new Set(['user.whoami', 'conduit.query']));
    assert.deepStrictEqual(readMethodCache(path), new Set(['conduit.query', 'user.whoami']));
    writeFileSync(path, '{"methods":');
    assert.strictEqual(readMethodCache(path), null);
  });
});

describe('hideUnavailableTools', () => {
  const lacking = [...everyMethod].filter((method) => !method.startsWith('conpherence.')).concat('conduit.query');

  it('waits for conduit.query on the first run and caches its answer', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'phab-mcp-')), 'methods.json');
    const server = new McpServer({ name: 'test', version: '0' });
    const tools = registerAllTools(server, {} as ConduitClient);
    await hideUnavailableTools(tools, methodsClient(lacking), path);
    assert.strictEqual(tools.get('phabricator_conpherence_edit')!.enabled, false);
    assert.deepStrictEqual(readMethodCache(path), new Set(lacking));
  });

  it('starts from the cache without waiting, then applies and caches a changed method list', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'phab-mcp-')), 'methods.json');
    writeMethodCache(path, new Set(lacking));
    const server = new McpServer({ name: 'test', version: '0' });
    const tools = registerAllTools(server, {} as ConduitClient);
    let answer!: () => void;
    const slow = {
      call: () => new Promise((resolve) => {
        answer = () => resolve(Object.fromEntries([...everyMethod, 'conduit.query'].map((name) => [name, {}])));
      }),
    } as unknown as ConduitClient;

    const { refreshed } = await hideUnavailableTools(tools, slow, path);
    const client = await connect(server);
    assert.ok(!(await listed(client)).includes('phabricator_conpherence_edit'));

    let notified = false;
    client.setNotificationHandler(ToolListChangedNotificationSchema, async () => { notified = true; });
    answer();
    await refreshed;
    assert.ok((await listed(client)).includes('phabricator_conpherence_edit'));
    assert.ok(notified, 'the client was not told the tool list changed');
    assert.ok(readMethodCache(path)!.has('conpherence.edit'));
    await client.close();
  });

  it('keeps the cached list when the refresh fails', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'phab-mcp-')), 'methods.json');
    writeMethodCache(path, new Set(lacking));
    const before = readFileSync(path, 'utf-8');
    const server = new McpServer({ name: 'test', version: '0' });
    const tools = registerAllTools(server, {} as ConduitClient);
    const failing = { call: async () => { throw new Error('HTTP 502'); } } as unknown as ConduitClient;
    await silenced(async () => (await hideUnavailableTools(tools, failing, path)).refreshed);
    assert.strictEqual(tools.get('phabricator_conpherence_edit')!.enabled, false);
    assert.strictEqual(readFileSync(path, 'utf-8'), before);
  });
});

describe('recordTools', () => {
  it('records tools registered with tool() or registerTool()', () => {
    const tools = new Map();
    const server = recordTools(new McpServer({ name: 'test', version: '0' }), tools);
    const cb = async () => ({ content: [] });
    server.registerTool('phabricator_user_whoami', {}, cb);
    server.tool('phabricator_user_search', cb);
    assert.deepStrictEqual([...tools.keys()], ['phabricator_user_whoami', 'phabricator_user_search']);
  });

  it('refuses a tool that has no TOOL_METHODS entry', () => {
    const server = recordTools(new McpServer({ name: 'test', version: '0' }), new Map());
    assert.throws(
      () => server.registerTool('phabricator_new_thing', {}, async () => ({ content: [] })),
      /phabricator_new_thing has no entry in TOOL_METHODS/,
    );
  });
});
