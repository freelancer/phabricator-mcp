import { describe, it } from 'node:test';
import assert from 'node:assert';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { ConduitClient } from '../client/conduit.js';
import { registerAllTools } from './index.js';

async function listTools() {
  const server = new McpServer({ name: 'test', version: '0' });
  registerAllTools(server, {} as ConduitClient);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientTransport);
  const { tools } = await client.listTools();
  await client.close();
  return tools;
}

const WRITE_NAME = /_(create|edit|delete|comment|send|publish|upload|command|done)$/;
const READ_NAME = /_(search|query|read|lookup|info|raw|paths|browse|content|history|whoami|version)$/;

describe('tool annotations', () => {
  it('say whether every tool reads or writes, and whether writes are destructive', async () => {
    const tools = await listTools();
    assert.ok(tools.length > 0);
    for (const tool of tools) {
      const hints = tool.annotations ?? {};
      assert.strictEqual(typeof hints.readOnlyHint, 'boolean', `${tool.name} has no readOnlyHint`);
      if (!hints.readOnlyHint) {
        assert.strictEqual(typeof hints.destructiveHint, 'boolean', `${tool.name} has no destructiveHint`);
      }
    }
  });

  it('never mark a tool that writes as read-only', async () => {
    const tools = await listTools();
    const writes = tools.filter((tool) => WRITE_NAME.test(tool.name));
    assert.ok(writes.length > 0);
    for (const tool of writes) {
      assert.strictEqual(tool.annotations?.readOnlyHint, false, `${tool.name} writes but is read-only`);
      if (/_(edit|delete)$/.test(tool.name)) {
        assert.strictEqual(tool.annotations?.destructiveHint, true, `${tool.name} edits or deletes but is not destructive`);
      }
    }
  });

  it('mark search, query and read tools read-only', async () => {
    const tools = await listTools();
    const reads = tools.filter((tool) => READ_NAME.test(tool.name));
    for (const tool of reads) {
      assert.strictEqual(tool.annotations?.readOnlyHint, true, `${tool.name} is not read-only`);
    }
  });

  it('name every tool as either a read or a write, so the checks above cover it', async () => {
    for (const tool of await listTools()) {
      assert.ok(WRITE_NAME.test(tool.name) !== READ_NAME.test(tool.name), `${tool.name} is not named as a read or a write`);
    }
  });
});
