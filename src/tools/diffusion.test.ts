import { describe, it } from 'node:test';
import assert from 'node:assert';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { ConduitClient } from '../client/conduit.js';
import { registerDiffusionTools } from './diffusion.js';

const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);
const FILECONTENTQUERY_PARAMS = ['path', 'commit', 'timeout', 'byteLimit', 'callsign', 'repository', 'branch'];

// A repository whose `main` can move, with one stored file per commit.
function fakeRepository(files: Record<string, string>) {
  const state = { main: OLD, calls: [] as string[] };
  const client = {
    call: async (method: string, params: Record<string, unknown> = {}) => {
      state.calls.push(method);
      if (method === 'diffusion.resolverefs') {
        const ref = (params.refs as string[])[0]!;
        return ref === 'main' ? { main: [{ type: 'branch', identifier: state.main }] } : [];
      }
      if (method === 'diffusion.filecontentquery') {
        const unknown = Object.keys(params).filter((key) => !FILECONTENTQUERY_PARAMS.includes(key));
        if (unknown.length > 0) {
          throw new Error(`does not define these parameters: ${unknown.join(', ')}`);
        }
        const text = files[params.commit as string]!;
        if (Buffer.byteLength(text) > (params.byteLimit as number)) {
          return { tooHuge: true, tooSlow: false, filePHID: null };
        }
        return { tooHuge: false, tooSlow: false, filePHID: `PHID-FILE-${params.commit as string}` };
      }
      if (method === 'file.download') {
        return Buffer.from(files[(params.phid as string).slice('PHID-FILE-'.length)]!).toString('base64');
      }
      if (method === 'file.info') {
        return { mimeType: 'image/png', byteSize: '3' };
      }
      throw new Error(`unexpected ${method}`);
    },
  } as unknown as ConduitClient;
  return { client, state };
}

async function connect(client: ConduitClient) {
  const server = new McpServer({ name: 'test', version: '0' });
  registerDiffusionTools(server, client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: 'test', version: '0' });
  await mcp.connect(clientTransport);
  return async (args: Record<string, unknown>) => {
    const result = await mcp.callTool({ name: 'phabricator_repository_file_content', arguments: args });
    return { ...result, texts: (result.content as Array<{ text: string }>).map((block) => block.text) };
  };
}

describe('phabricator_repository_file_content', () => {
  it('reads every page of a branch at the commit the first page resolved', async () => {
    const { client, state } = fakeRepository({ [OLD]: 'old 1\nold 2\n', [NEW]: 'new 0\nold 1\nold 2\n' });
    const read = await connect(client);
    const first = await read({ repository: 'R', path: 'f', commit: 'main', lineCount: 1 });
    assert.deepStrictEqual(first.texts, ['old 1\n', `[Line 1 of 2. Pass startLine: 2, commit: ${OLD} to read on.]`]);

    state.main = NEW;
    const second = await read({ repository: 'R', path: 'f', commit: OLD, startLine: 2 });
    assert.deepStrictEqual(second.texts, ['old 2\n', '[Line 2 of 2.]']);
    assert.strictEqual(state.calls.filter((method) => method === 'file.download').length, 1);
  });

  it('downloads a file once for reads that arrive together', async () => {
    const { client, state } = fakeRepository({ [OLD]: 'x\ny\n' });
    const read = await connect(client);
    await Promise.all([
      read({ repository: 'R', path: 'f', commit: OLD, lineCount: 1 }),
      read({ repository: 'R', path: 'f', commit: OLD, startLine: 2 }),
    ]);
    assert.strictEqual(state.calls.filter((method) => method === 'file.download').length, 1);
  });

  it('returns a binary file\'s metadata with its file PHID', async () => {
    const { client } = fakeRepository({ [OLD]: 'PNG' });
    const read = await connect(client);
    const result = await read({ repository: 'R', path: 'logo.png', commit: OLD });
    assert.deepStrictEqual(JSON.parse(result.texts[0]!), {
      binary: true, mimeType: 'image/png', byteSize: 3, filePHID: `PHID-FILE-${OLD}`,
    });
  });

  it('refuses a cached file over a smaller byteLimit, and a byteLimit of 0', async () => {
    const { client } = fakeRepository({ [OLD]: 'abcdef\n' });
    const read = await connect(client);
    await read({ repository: 'R', path: 'f', commit: OLD });
    const small = await read({ repository: 'R', path: 'f', commit: OLD, byteLimit: 3 });
    assert.deepStrictEqual(JSON.parse(small.texts[0]!), { tooHuge: true, tooSlow: false });
    const zero = await read({ repository: 'R', path: 'f', commit: OLD, byteLimit: 0 });
    assert.ok(zero.isError);
  });
});
