import { describe, it } from 'node:test';
import assert from 'node:assert';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { ConduitClient } from '../client/conduit.js';
import { registerFeedTools } from './feed.js';

// Runs a tool against a fake Conduit client and returns the calls it made.
async function callTool(name: string, args: Record<string, unknown>) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const client = {
    call: async (method: string, params: Record<string, unknown> = {}) => {
      calls.push({ method, params });
      return {};
    },
  } as unknown as ConduitClient;

  const server = new McpServer({ name: 'test', version: '0' });
  registerFeedTools(server, client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: 'test', version: '0' });
  await mcp.connect(clientTransport);
  const result = await mcp.callTool({ name, arguments: args });
  await mcp.close();
  return { calls, result };
}

describe('phabricator_feed_query', () => {
  it('passes chronological keys above 2^53 through unchanged', async () => {
    const { calls, result } = await callTool('phabricator_feed_query', {
      after: '7696838331819949415',
      before: '7696841833969872725',
    });
    assert.ok(!result.isError);
    assert.deepStrictEqual(calls, [{
      method: 'feed.query',
      params: { after: '7696838331819949415', before: '7696841833969872725' },
    }]);
  });
});
