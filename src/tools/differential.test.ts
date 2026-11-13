import { describe, it } from 'node:test';
import assert from 'node:assert';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ConduitError, type ConduitClient } from '../client/conduit.js';
import { registerDifferentialTools } from './differential.js';

type Call = { method: string; params: Record<string, unknown> };

// Runs a tool against a fake Conduit client and returns the calls it made.
// `respond` answers each call; it may throw, as the client does for a Conduit
// error.
async function callTool(
  name: string,
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
  registerDifferentialTools(server, client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcp = new Client({ name: 'test', version: '0' });
  await mcp.connect(clientTransport);
  const result = await mcp.callTool({ name, arguments: args });
  await mcp.close();
  const text = (result.content as Array<{ text: string }>)[0]!.text;
  return { calls, result, text };
}

// Drops the undefined values JSON leaves out of the request.
function sent(call: Call) {
  return JSON.parse(JSON.stringify(call.params));
}

const reply = { id: 9, phid: 'PHID-XCMT-9', fields: { replyToCommentPHID: 'PHID-XCMT-1', lineNumber: 3 } };

describe('phabricator_revision_inline_comment', () => {
  it('sends a reply with only what was given, no default place', async () => {
    const { calls, result, text } = await callTool(
      'phabricator_revision_inline_comment',
      { revisionID: 'D12', replyToInlineID: 1, content: 'Fixed.' },
      () => reply,
    );

    assert.ok(!result.isError, text);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0]!.method, 'differential.inline.create');
    assert.deepStrictEqual(sent(calls[0]!), { revisionID: 12, replyToInlineID: 1, content: 'Fixed.' });
    assert.strictEqual(JSON.parse(text).fields.replyToCommentPHID, 'PHID-XCMT-1');
  });

  it('passes an explicit place through for Phabricator to check against the parent', async () => {
    const { calls } = await callTool(
      'phabricator_revision_inline_comment',
      { revisionID: 12, replyToInlineID: 1, content: 'Fixed.', filePath: 'a.ts', lineNumber: 3, isNewFile: false },
      () => reply,
    );

    assert.deepStrictEqual(sent(calls[0]!), {
      revisionID: 12, replyToInlineID: 1, content: 'Fixed.', filePath: 'a.ts', lineNumber: 3, isNewFile: false,
    });
  });

  it('does not fall back to differential.createinline for a reply', async () => {
    const { calls, result } = await callTool(
      'phabricator_revision_inline_comment',
      { revisionID: 12, replyToInlineID: 1, content: 'Fixed.' },
      () => {
        throw new ConduitError('ERR-CONDUIT-CALL', 'Method does not exist.');
      },
    );

    assert.strictEqual(result.isError, true);
    assert.deepStrictEqual(calls.map((c) => c.method), ['differential.inline.create']);
  });

  it('returns a refused reply as a tool error', async () => {
    const { result, text } = await callTool(
      'phabricator_revision_inline_comment',
      { revisionID: 12, replyToInlineID: 7, content: 'Fixed.' },
      () => {
        throw new ConduitError('ERR-BAD-REPLY', 'Inline comment 7 is your unpublished draft.');
      },
    );

    assert.strictEqual(result.isError, true);
    assert.match(text, /unpublished draft/);
  });

  it('still needs filePath and lineNumber for a new comment', async () => {
    const { calls, result, text } = await callTool(
      'phabricator_revision_inline_comment',
      { revisionID: 12, content: 'Hmm.' },
      () => ({}),
    );

    assert.strictEqual(result.isError, true);
    assert.match(text, /filePath and lineNumber are required/);
    assert.deepStrictEqual(calls, []);
  });

  it('sends a new comment with its defaults, as before', async () => {
    const { calls } = await callTool(
      'phabricator_revision_inline_comment',
      { revisionID: 12, filePath: 'a.ts', lineNumber: 3, content: 'Hmm.' },
      () => ({ id: 11 }),
    );

    assert.deepStrictEqual(sent(calls[0]!), {
      revisionID: 12, filePath: 'a.ts', lineNumber: 3, lineLength: 0, content: 'Hmm.', isNewFile: true,
    });
  });
});

describe('phabricator_revision_edit acceptAs', () => {
  const edited = { object: { id: 12, phid: 'PHID-DREV-12' }, transactions: [{ phid: 'PHID-XACT-1' }] };
  const respond = (method: string) => (method === 'user.whoami' ? { phid: 'PHID-USER-me' } : edited);

  it('sends ["self"] as accept.as with the caller\'s own PHID', async () => {
    const { calls, result, text } = await callTool(
      'phabricator_revision_edit',
      { objectIdentifier: 'D12', acceptAs: ['self'] },
      respond,
    );

    assert.ok(!result.isError, text);
    assert.deepStrictEqual(calls.map((call) => call.method), ['user.whoami', 'differential.revision.edit']);
    assert.deepStrictEqual(sent(calls[1]!), {
      objectIdentifier: 'D12',
      transactions: [{ type: 'accept.as', value: ['PHID-USER-me'] }],
    });
  });

  it('sends chosen groups as given, with self resolved once and no duplicates', async () => {
    const { calls } = await callTool(
      'phabricator_revision_edit',
      { objectIdentifier: 'D12', comment: 'LGTM', acceptAs: ['self', 'PHID-PROJ-a', 'PHID-USER-me'] },
      respond,
    );

    assert.deepStrictEqual(sent(calls[1]!).transactions, [
      { type: 'comment', value: 'LGTM' },
      { type: 'accept.as', value: ['PHID-USER-me', 'PHID-PROJ-a'] },
    ]);
  });

  it('does not look the caller up when "self" is not used', async () => {
    const { calls } = await callTool(
      'phabricator_revision_edit',
      { objectIdentifier: 'D12', acceptAs: ['PHID-PROJ-a'] },
      respond,
    );

    assert.deepStrictEqual(calls.map((call) => call.method), ['differential.revision.edit']);
    assert.deepStrictEqual(sent(calls[0]!).transactions, [{ type: 'accept.as', value: ['PHID-PROJ-a'] }]);
  });

  it('refuses acceptAs with an action before any call', async () => {
    const { calls, result, text } = await callTool(
      'phabricator_revision_edit',
      { objectIdentifier: 'D12', action: 'accept', acceptAs: ['self'] },
      respond,
    );

    assert.strictEqual(result.isError, true);
    assert.match(text, /acceptAs cannot be combined with action/);
    assert.deepStrictEqual(calls, []);
  });

  it('refuses an empty acceptAs before any call', async () => {
    const { calls, result } = await callTool(
      'phabricator_revision_edit',
      { objectIdentifier: 'D12', acceptAs: [] },
      respond,
    );

    assert.strictEqual(result.isError, true);
    assert.deepStrictEqual(calls, []);
  });

  it('still sends action accept as the boolean transaction', async () => {
    const { calls } = await callTool(
      'phabricator_revision_edit',
      { objectIdentifier: 'D12', action: 'accept' },
      respond,
    );

    assert.deepStrictEqual(sent(calls[0]!).transactions, [{ type: 'accept', value: true }]);
  });
});
