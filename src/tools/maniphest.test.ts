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

describe('phabricator_task_edit dueDate', () => {
  const sent = async (dueDate: unknown) => {
    const { calls, result } = await callTool('phabricator_task_edit', { objectIdentifier: 'T1', dueDate });
    return { calls, result };
  };

  it('sends a date as maniphest:deadline, for Phabricator to read in the caller\'s timezone', async () => {
    const { calls, result } = await sent('2026-11-20');
    assert.ok(!result.isError);
    assert.deepStrictEqual(calls, [{
      method: 'maniphest.edit',
      params: {
        objectIdentifier: 'T1',
        transactions: [{ type: 'maniphest:deadline', value: '2026-11-20' }],
      },
    }]);
  });

  it('sends an epoch', async () => {
    const { calls, result } = await sent(1800000000);
    assert.ok(!result.isError);
    assert.deepStrictEqual(calls[0].params.transactions, [{ type: 'maniphest:deadline', value: 1800000000 }]);
  });

  it('sends null to remove the due date', async () => {
    const { calls } = await sent(null);
    assert.deepStrictEqual(calls[0].params.transactions, [{ type: 'maniphest:deadline', value: null }]);
  });

  it('sends the due date in the same edit as the other changes', async () => {
    const { calls } = await callTool('phabricator_task_edit', {
      objectIdentifier: 'T1',
      title: 'New title',
      dueDate: '2026-11-20',
    });
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0].params.transactions, [
      { type: 'title', value: 'New title' },
      { type: 'maniphest:deadline', value: '2026-11-20' },
    ]);
  });

  it('refuses other shapes without calling Phabricator', async () => {
    for (const value of ['20261120', '1800000000', '20/11/2026', '2026-11-20T09:00:00Z', 'next friday', 0, -1, 1.5, true]) {
      const { calls, result } = await sent(value);
      assert.ok(result.isError, JSON.stringify(value));
      assert.strictEqual(calls.length, 0, JSON.stringify(value));
    }
  });

  it('leaves the due date alone when not given', async () => {
    const { calls } = await callTool('phabricator_task_edit', { objectIdentifier: 'T1', title: 'x' });
    assert.deepStrictEqual(calls[0].params.transactions, [{ type: 'title', value: 'x' }]);
  });
});
