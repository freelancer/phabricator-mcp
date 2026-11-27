import { describe, it } from 'node:test';
import assert from 'node:assert';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { ConduitClient } from '../client/conduit.js';
import { registerHeraldTools } from './herald.js';

type Call = { method: string; params: Record<string, unknown> };

async function callTool(
  args: Record<string, unknown>,
  respond: (method: string, params: Record<string, unknown>) => unknown,
) {
  const calls: Call[] = [];
  const client = {
    call: async (method: string, params: Record<string, unknown> = {}) => {
      calls.push({ method, params });
      return respond(method, params);
    },
  } as unknown as ConduitClient;

  const server = new McpServer({ name: 'test', version: '0' });
  registerHeraldTools(server, client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: 'test', version: '0' });
  await mcp.connect(clientTransport);
  const result = await mcp.callTool({ name: 'phabricator_herald_transcript_search', arguments: args });
  await mcp.close();
  const text = (result.content as Array<{ text: string }>)[0]!.text;
  return { calls, result, text };
}

const transcript = {
  revisionID: 233629,
  data: [{
    transcriptID: 7,
    time: 1794285820,
    dryRun: false,
    rules: [{
      ruleID: 345,
      monogram: 'H345',
      name: 'API / Core Services Database Changes',
      result: 'matched',
      conditions: [{ field: 'differential.revision.diff.affected', condition: 'regexp', testValue: '/\\.sql$/', result: 'passed' }],
      actions: [{ action: 'differential.reviewers.blocking', target: ['PHID-PROJ-x'], applied: true }],
    }],
  }],
};

describe('phabricator_herald_transcript_search', () => {
  it('calls herald.transcript.search with a plain revision ID', async () => {
    const { calls, text } = await callTool({ revisionID: 'D233629' }, () => transcript);

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0]!.method, 'herald.transcript.search');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(calls[0]!.params)), { revisionID: 233629 });
    assert.strictEqual(JSON.parse(text).data[0].rules[0].monogram, 'H345');
  });

  it('passes the filters through unchanged', async () => {
    const { calls } = await callTool(
      { revisionID: 12, ruleIDs: [345, '282'], matchedOnly: false, includeDryRuns: true, limit: 5 },
      () => transcript,
    );

    assert.deepStrictEqual(JSON.parse(JSON.stringify(calls[0]!.params)), {
      revisionID: 12,
      ruleIDs: [345, 282],
      matchedOnly: false,
      includeDryRuns: true,
      limit: 5,
    });
  });

  it('refuses a limit above what Phabricator allows', async () => {
    const { result, calls } = await callTool({ revisionID: 12, limit: 50 }, () => transcript);

    assert.strictEqual(result.isError, true);
    assert.strictEqual(calls.length, 0);
  });
});
