import { describe, it } from 'node:test';
import assert from 'node:assert';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { ConduitClient } from '../client/conduit.js';
import { registerManiphestTools } from './maniphest.js';

// Runs a tool against a fake Conduit client and returns the calls it made.
async function callTool(name: string, args: Record<string, unknown>) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const client = {
    call: async (method: string, params: Record<string, unknown> = {}) => {
      calls.push({ method, params });
      return { object: { id: 1, phid: 'PHID-TASK-1' }, transactions: [] };
    },
  } as unknown as ConduitClient;

  const server = new McpServer({ name: 'test', version: '0' });
  registerManiphestTools(server, client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: 'test', version: '0' });
  await mcp.connect(clientTransport);
  const result = await mcp.callTool({ name, arguments: args });
  await mcp.close();
  return { calls, result };
}

describe('phabricator_task_edit', () => {
  it('sends a column move as a list of column PHIDs', async () => {
    const { calls, result } = await callTool('phabricator_task_edit', {
      objectIdentifier: 'T1',
      columnPHID: 'PHID-PCOL-1',
    });
    assert.ok(!result.isError);
    assert.deepStrictEqual(calls, [{
      method: 'maniphest.edit',
      params: {
        objectIdentifier: 'T1',
        transactions: [{ type: 'column', value: ['PHID-PCOL-1'] }],
      },
    }]);
  });
});
