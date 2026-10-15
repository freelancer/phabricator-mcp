import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConduitError, type ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonCoerce } from './coerce.js';
import { jsonResult } from './result.js';

const revisionID = z.preprocess(
  (val) => (typeof val === 'string' ? val.replace(/^D/i, '') : val),
  z.coerce.number(),
);

export function registerDifferentialTools(server: McpServer, client: ConduitClient) {
  // Search revisions
  server.tool(
    'phabricator_revision_search',
    'Search Differential revisions (code reviews)',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active", "authored"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('Revision IDs'),
        phids: z.array(z.string()).optional().describe('Revision PHIDs'),
        authorPHIDs: z.array(z.string()).optional().describe('Author PHIDs'),
        reviewerPHIDs: z.array(z.string()).optional().describe('Reviewer PHIDs'),
        repositoryPHIDs: z.array(z.string()).optional().describe('Repository PHIDs'),
        statuses: z.array(z.string()).optional().describe('Statuses: needs-review, needs-revision, accepted, published, abandoned, changes-planned, draft'),
        responsiblePHIDs: z.array(z.string()).optional().describe('User PHIDs who are responsible (as author or reviewer)'),
        createdStart: z.coerce.number().optional().describe('Created after (epoch timestamp)'),
        createdEnd: z.coerce.number().optional().describe('Created before (epoch timestamp)'),
        modifiedStart: z.coerce.number().optional().describe('Modified after (epoch timestamp)'),
        modifiedEnd: z.coerce.number().optional().describe('Modified before (epoch timestamp)'),
        subscribers: z.array(z.string()).optional().describe('Subscriber user/project PHIDs'),
        projects: z.array(z.string()).optional().describe('Project PHIDs'),
        query: z.string().optional().describe('Full-text search query'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
        reviewers: z.boolean().optional().describe('Include reviewers'),
        subscribers: z.boolean().optional().describe('Include subscribers'),
        projects: z.boolean().optional().describe('Include projects'),
      })).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order: "newest", "oldest", "updated", "relevance"'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    async (params) => {
      const result = await client.call('differential.revision.search', params);
      return jsonResult(result);
    },
  );

  // Edit revision
  server.tool(
    'phabricator_revision_edit',
    'Edit a Differential revision. Supports actions like accept, reject, abandon, request-review, plan-changes, and commandeer. Can also add/remove reviewers, subscribers, and comments.',
    {
      objectIdentifier: z.string().describe('Revision PHID or ID (e.g., "D123")'),
      title: z.string().optional().describe('New title'),
      summary: z.string().optional().describe('New summary'),
      testPlan: z.string().optional().describe('New test plan'),
      addReviewerPHIDs: z.array(z.string()).optional().describe('Add reviewers. Prefix with "blocking(PHID)" to add as blocking reviewer'),
      removeReviewerPHIDs: z.array(z.string()).optional().describe('Remove reviewers'),
      setReviewerPHIDs: z.array(z.string()).optional().describe('Replace all reviewers with this list. Prefix with "blocking(PHID)" for blocking'),
      addProjectPHIDs: z.array(z.string()).optional().describe('Add projects'),
      removeProjectPHIDs: z.array(z.string()).optional().describe('Remove projects'),
      comment: z.string().optional().describe('Add a comment'),
      action: z.enum(['accept', 'reject', 'abandon', 'reclaim', 'reopen', 'request-review', 'resign', 'commandeer', 'plan-changes', 'close']).optional().describe('Revision action to take. Each action is sent as its own transaction type with value true.'),
      draft: z.boolean().optional().describe('Hold revision as draft (true) or release from draft (false)'),
      addSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to add'),
      removeSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to remove'),
      repositoryPHID: z.string().optional().describe('Repository PHID to associate with the revision'),
      addTaskPHIDs: z.array(z.string()).optional().describe('Maniphest task PHIDs to associate'),
      removeTaskPHIDs: z.array(z.string()).optional().describe('Maniphest task PHIDs to remove'),
      addParentPHIDs: z.array(z.string()).optional().describe('Parent revision PHIDs to add (dependencies)'),
      removeParentPHIDs: z.array(z.string()).optional().describe('Parent revision PHIDs to remove'),
      addChildPHIDs: z.array(z.string()).optional().describe('Child revision PHIDs to add (dependents)'),
      removeChildPHIDs: z.array(z.string()).optional().describe('Child revision PHIDs to remove'),
    },
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [];

      if (params.title !== undefined) {
        transactions.push({ type: 'title', value: params.title });
      }
      if (params.summary !== undefined) {
        transactions.push({ type: 'summary', value: params.summary });
      }
      if (params.testPlan !== undefined) {
        transactions.push({ type: 'testPlan', value: params.testPlan });
      }
      if (params.addReviewerPHIDs !== undefined) {
        transactions.push({ type: 'reviewers.add', value: params.addReviewerPHIDs });
      }
      if (params.removeReviewerPHIDs !== undefined) {
        transactions.push({ type: 'reviewers.remove', value: params.removeReviewerPHIDs });
      }
      if (params.setReviewerPHIDs !== undefined) {
        transactions.push({ type: 'reviewers.set', value: params.setReviewerPHIDs });
      }
      if (params.addProjectPHIDs !== undefined) {
        transactions.push({ type: 'projects.add', value: params.addProjectPHIDs });
      }
      if (params.removeProjectPHIDs !== undefined) {
        transactions.push({ type: 'projects.remove', value: params.removeProjectPHIDs });
      }
      if (params.comment !== undefined) {
        transactions.push({ type: 'comment', value: params.comment });
      }
      if (params.action !== undefined) {
        transactions.push({ type: params.action, value: true });
      }
      if (params.draft !== undefined) {
        transactions.push({ type: 'draft', value: params.draft });
      }
      if (params.addSubscriberPHIDs !== undefined) {
        transactions.push({ type: 'subscribers.add', value: params.addSubscriberPHIDs });
      }
      if (params.removeSubscriberPHIDs !== undefined) {
        transactions.push({ type: 'subscribers.remove', value: params.removeSubscriberPHIDs });
      }
      if (params.repositoryPHID !== undefined) {
        transactions.push({ type: 'repositoryPHID', value: params.repositoryPHID });
      }
      if (params.addTaskPHIDs !== undefined) {
        transactions.push({ type: 'tasks.add', value: params.addTaskPHIDs });
      }
      if (params.removeTaskPHIDs !== undefined) {
        transactions.push({ type: 'tasks.remove', value: params.removeTaskPHIDs });
      }
      if (params.addParentPHIDs !== undefined) {
        transactions.push({ type: 'parents.add', value: params.addParentPHIDs });
      }
      if (params.removeParentPHIDs !== undefined) {
        transactions.push({ type: 'parents.remove', value: params.removeParentPHIDs });
      }
      if (params.addChildPHIDs !== undefined) {
        transactions.push({ type: 'children.add', value: params.addChildPHIDs });
      }
      if (params.removeChildPHIDs !== undefined) {
        transactions.push({ type: 'children.remove', value: params.removeChildPHIDs });
      }
      if (transactions.length === 0) {
        return { content: [{ type: 'text', text: 'No changes specified' }] };
      }

      const result = await client.call('differential.revision.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions,
      });
      return jsonResult(result);
    },
  );

  // Get raw diff content
  server.tool(
    'phabricator_diff_raw',
    'Get the raw diff/patch content for a Differential diff by diff ID. Use phabricator_diff_search to find the diff ID from a revision PHID first.',
    {
      diffID: z.coerce.number().describe('The diff ID (numeric, e.g., 1392561). Use phabricator_diff_search to find this from a revision.'),
    },
    async (params) => {
      const result = await client.call<string>('differential.getrawdiff', {
        diffID: params.diffID,
      });
      return { content: [{ type: 'text', text: result }] };
    },
  );

  // Search diffs
  server.tool(
    'phabricator_diff_search',
    'Search Differential diffs (code change snapshots within a revision). A revision may have multiple diffs as it gets updated.',
    {
      queryKey: z.string().optional().describe('Built-in query: "all"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('Diff IDs'),
        phids: z.array(z.string()).optional().describe('Diff PHIDs'),
        revisionPHIDs: z.array(z.string()).optional().describe('Revision PHIDs'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
        commits: z.boolean().optional().describe('Include commit info'),
      })).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order: "newest", "oldest"'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    async (params) => {
      const result = await client.call('differential.diff.search', params);
      return jsonResult(result);
    },
  );

  // Get changed file paths for a revision
  server.tool(
    'phabricator_revision_paths',
    'Get the list of changed file paths for a Differential revision. Returns an array of file path strings.',
    {
      revision_id: z.coerce.number().describe('Numeric revision ID (e.g., 123). Do not include the "D" prefix.'),
    },
    async (params) => {
      const result = await client.call('differential.getcommitpaths', {
        revision_id: params.revision_id,
      });
      return jsonResult(result);
    },
  );

  // Create inline comment on a diff
  server.tool(
    'phabricator_revision_inline_comment',
    'Create a draft inline comment on a Differential diff, optionally highlighting a character range and attaching a suggested edit. Drafts are visible only to you until you call phabricator_revision_inline_publish; a plain comment via phabricator_revision_edit does NOT publish them. Ranges and suggestions need the differential.inline.* Conduit extension; without it, plain line comments fall back to differential.createinline.',
    {
      revisionID: revisionID.describe('Revision ID (e.g., 123 or "D123")'),
      diffID: z.coerce.number().optional().describe('Diff ID to comment on. Defaults to the revision\'s active diff.'),
      filePath: z.string().describe('Path to the file being commented on'),
      lineNumber: z.coerce.number().describe('First line of the comment'),
      lineLength: z.coerce.number().optional().describe('How many more lines the comment spans after lineNumber (default: 0, a single line)'),
      content: z.string().describe('Comment text (supports Remarkup)'),
      isNewFile: z.boolean().optional().describe('Whether the line number refers to the new file (true) or old file (false). Default: true'),
      startOffset: z.coerce.number().optional().describe('0-based column on the first line where the highlighted range starts, counted as the web UI shows it (each tab is up to 2 columns). Requires endOffset.'),
      endOffset: z.coerce.number().optional().describe('Exclusive column on the last line where the highlighted range ends. Requires startOffset.'),
      suggestionText: z.string().optional().describe('Suggested replacement for the commented lines on the new side. "" suggests deleting them. Needs a diff uploaded with full context, as arc diff does.'),
    },
    async (params) => {
      const base = {
        revisionID: params.revisionID,
        diffID: params.diffID,
        filePath: params.filePath,
        lineNumber: params.lineNumber,
        lineLength: params.lineLength ?? 0,
        content: params.content,
        isNewFile: params.isNewFile ?? true,
      };
      const extended = params.startOffset !== undefined
        || params.endOffset !== undefined
        || params.suggestionText !== undefined;

      let result: unknown;
      try {
        result = await client.call('differential.inline.create', {
          ...base,
          startOffset: params.startOffset,
          endOffset: params.endOffset,
          suggestionText: params.suggestionText,
        });
      } catch (error) {
        if (extended || !(error instanceof ConduitError) || error.code !== 'ERR-CONDUIT-CALL') {
          throw error;
        }
        result = await client.call('differential.createinline', {
          ...base,
          isNewFile: base.isNewFile ? 1 : 0,
        });
      }
      return jsonResult(result);
    },
  );

  // Search inline comments
  server.tool(
    'phabricator_revision_inline_search',
    'List inline comments on a Differential revision with their side (isNewFile), line range, character range, suggested edit and Done state. Returns every published comment plus your own drafts, newest first. Needs the differential.inline.* Conduit extension.',
    {
      revisionID: revisionID.describe('Revision ID (e.g., 123 or "D123")'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    async (params) => {
      const result = await client.call('differential.inline.search', params);
      return jsonResult(result);
    },
  );

  // Publish draft inline comments
  server.tool(
    'phabricator_revision_inline_publish',
    'Publish your draft inline comments on a Differential revision, with an optional top-level comment, as one review: the same as pressing "Submit" in the web UI. Also publishes pending "Done" changes you made as the revision author. Without inlineIDs, EVERY draft you have on the revision is published, including ones started in a browser. Needs "Can Edit" on the revision and the differential.inline.* Conduit extension. If a call times out, search before retrying: naming an already-published inline fails.',
    {
      revisionID: revisionID.describe('Revision ID (e.g., 123 or "D123")'),
      inlineIDs: z.array(z.coerce.number()).optional().describe('Publish only these draft inline IDs. Omit to publish all your drafts on the revision.'),
      message: z.string().optional().describe('Top-level review comment (supports Remarkup)'),
    },
    async (params) => {
      const result = await client.call('differential.inline.publish', params);
      return jsonResult(result);
    },
  );

  // Check or uncheck Done on an inline comment
  server.tool(
    'phabricator_revision_inline_done',
    'Check or uncheck "Done" on a Differential inline comment. Allowed for the revision author, or for the comment author while it is still a draft. A check by the revision author stays pending (isDonePending) until they next publish, e.g. with phabricator_revision_inline_publish. Needs the differential.inline.* Conduit extension.',
    {
      inlineID: z.coerce.number().describe('Inline comment ID (the "id" from phabricator_revision_inline_search)'),
      isDone: z.boolean().describe('true to mark Done, false to clear it'),
    },
    async (params) => {
      const result = await client.call('differential.inline.setdone', params);
      return jsonResult(result);
    },
  );
}
