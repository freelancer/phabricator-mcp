import { describe, it } from 'node:test';
import assert from 'node:assert';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { ConduitClient } from '../client/conduit.js';
import { registerConpherenceTools } from './conpherence.js';

// Runs a tool against a fake Conduit client and returns the calls it made.
// With `failMessage`, posting a comment to an existing room throws.
async function callTool(name: string, args: Record<string, unknown>, failMessage = false) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const client = {
    call: async (method: string, params: Record<string, unknown> = {}) => {
      calls.push({ method, params });
      if (failMessage && params.objectIdentifier !== undefined) {
        throw new Error('ERR-CONDUIT-CORE: timed out');
      }
      return method === 'user.whoami'
        ? { phid: 'PHID-USER-me' }
        : { object: { id: 1, phid: 'PHID-CONP-1' }, transactions: [] };
    },
  } as unknown as ConduitClient;

  const server = new McpServer({ name: 'test', version: '0' });
  registerConpherenceTools(server, client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: 'test', version: '0' });
  await mcp.connect(clientTransport);
  const result = await mcp.callTool({ name, arguments: args });
  await mcp.close();
  return { calls, result };
}

describe('phabricator_conpherence_create', () => {
  it('adds the caller, creates the room, then posts the message to it', async () => {
    const { calls, result } = await callTool('phabricator_conpherence_create', {
      title: 'Room',
      topic: 'Topic',
      message: 'Hello',
      participantPHIDs: ['PHID-USER-other', 'PHID-USER-me'],
    });
    assert.ok(!result.isError);
    assert.deepStrictEqual(calls, [
      { method: 'user.whoami', params: {} },
      {
        method: 'conpherence.edit',
        params: {
          transactions: [
            { type: 'name', value: 'Room' },
            { type: 'topic', value: 'Topic' },
            { type: 'participants.add', value: ['PHID-USER-me', 'PHID-USER-other'] },
          ],
        },
      },
      {
        method: 'conpherence.edit',
        params: { objectIdentifier: 'PHID-CONP-1', transactions: [{ type: 'comment', value: 'Hello' }] },
      },
    ]);
  });

  it('names the created room when posting the message fails', async () => {
    const { result } = await callTool('phabricator_conpherence_create', { title: 'Room', message: 'Hello' }, true);
    assert.ok(result.isError);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    assert.match(text, /Created room PHID-CONP-1, but posting the message failed: ERR-CONDUIT-CORE: timed out/);
  });

  it('makes no second call without a message', async () => {
    const { calls } = await callTool('phabricator_conpherence_create', { title: 'Room' });
    assert.deepStrictEqual(calls.map((call) => call.method), ['user.whoami', 'conpherence.edit']);
    assert.deepStrictEqual(calls[1]!.params.transactions, [
      { type: 'name', value: 'Room' },
      { type: 'participants.add', value: ['PHID-USER-me'] },
    ]);
  });
});
