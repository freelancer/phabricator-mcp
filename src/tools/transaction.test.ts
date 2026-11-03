import { describe, it } from 'node:test';
import assert from 'node:assert';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { ConduitClient } from '../client/conduit.js';
import { registerTransactionTools } from './transaction.js';

// Runs a tool against a fake Conduit client and returns the calls it made.
// With `error`, the call throws it, as the client does for a Conduit error.
async function callTool(name: string, args: Record<string, unknown>, error?: string) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const client = {
    call: async (method: string, params: Record<string, unknown> = {}) => {
      calls.push({ method, params });
      if (error !== undefined) {
        throw new Error(error);
      }
      return { transactionPHID: params.transactionPHID, comment: { version: 2, content: { raw: params.content } } };
    },
  } as unknown as ConduitClient;

  const server = new McpServer({ name: 'test', version: '0' });
  registerTransactionTools(server, client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: 'test', version: '0' });
  await mcp.connect(clientTransport);
  const result = await mcp.callTool({ name, arguments: args });
  await mcp.close();
  return { calls, result };
}

describe('phabricator_transaction_comment_edit', () => {
  it('sends the object, transaction and new text to transaction.comment.edit', async () => {
    const args = { objectIdentifier: 'T123', transactionPHID: 'PHID-XACT-TASK-1', content: 'Fixed typo.' };
    const { calls, result } = await callTool('phabricator_transaction_comment_edit', args);

    assert.deepStrictEqual(calls, [{ method: 'transaction.comment.edit', params: args }]);
    assert.ok(!result.isError);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    assert.deepStrictEqual(JSON.parse(text), {
      transactionPHID: 'PHID-XACT-TASK-1',
      comment: { version: 2, content: { raw: 'Fixed typo.' } },
    });
  });

  it('returns a refusal as a tool error', async () => {
    const { result } = await callTool(
      'phabricator_transaction_comment_edit',
      { objectIdentifier: 'T123', transactionPHID: 'PHID-XACT-TASK-1', content: 'Hijack.' },
      'ERR-NOT-EDITABLE: Only the author of the comment on transaction "PHID-XACT-TASK-1" can edit it.',
    );

    assert.strictEqual(result.isError, true);
    const text = (result.content as Array<{ text: string }>)[0]!.text;
    assert.match(text, /Only the author of the comment/);
  });

  it('refuses empty text without calling Conduit', async () => {
    const { calls, result } = await callTool('phabricator_transaction_comment_edit', {
      objectIdentifier: 'T123',
      transactionPHID: 'PHID-XACT-TASK-1',
      content: '',
    });

    assert.deepStrictEqual(calls, []);
    assert.strictEqual(result.isError, true);
  });
});
