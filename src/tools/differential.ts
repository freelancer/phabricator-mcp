import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';

export function registerDifferentialTools(server: McpServer, client: ConduitClient) {
  // Search revisions
  server.tool(
    'phabricator_revision_search',
    'Search Differential revisions (code reviews)',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active", "authored", "waiting"'),
      constraints: z.object({
        ids: z.array(z.number()).optional().describe('Revision IDs'),
        phids: z.array(z.string()).optional().describe('Revision PHIDs'),
        authorPHIDs: z.array(z.string()).optional().describe('Author PHIDs'),
        reviewerPHIDs: z.array(z.string()).optional().describe('Reviewer PHIDs'),
        repositoryPHIDs: z.array(z.string()).optional().describe('Repository PHIDs'),
        statuses: z.array(z.string()).optional().describe('Statuses: needs-review, needs-revision, accepted, published, abandoned, changes-planned'),
      }).optional().describe('Search constraints'),
      attachments: z.object({
        reviewers: z.boolean().optional().describe('Include reviewers'),
        subscribers: z.boolean().optional().describe('Include subscribers'),
        projects: z.boolean().optional().describe('Include projects'),
      }).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.number().max(100).optional().describe('Maximum results'),
      after: z.string().optional().describe('Pagination cursor'),
    },
    async (params) => {
      const result = await client.call('differential.revision.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Edit revision
  server.tool(
    'phabricator_revision_edit',
    'Edit a Differential revision',
    {
      objectIdentifier: z.string().describe('Revision PHID or ID (e.g., "D123")'),
      title: z.string().optional().describe('New title'),
      summary: z.string().optional().describe('New summary'),
      testPlan: z.string().optional().describe('New test plan'),
      addReviewerPHIDs: z.array(z.string()).optional().describe('Add reviewers'),
      removeReviewerPHIDs: z.array(z.string()).optional().describe('Remove reviewers'),
      addProjectPHIDs: z.array(z.string()).optional().describe('Add projects'),
      removeProjectPHIDs: z.array(z.string()).optional().describe('Remove projects'),
      comment: z.string().optional().describe('Add a comment'),
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
      if (params.addProjectPHIDs !== undefined) {
        transactions.push({ type: 'projects.add', value: params.addProjectPHIDs });
      }
      if (params.removeProjectPHIDs !== undefined) {
        transactions.push({ type: 'projects.remove', value: params.removeProjectPHIDs });
      }
      if (params.comment !== undefined) {
        transactions.push({ type: 'comment', value: params.comment });
      }

      if (transactions.length === 0) {
        return { content: [{ type: 'text', text: 'No changes specified' }] };
      }

      const result = await client.call('differential.revision.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Get raw diff content
  server.tool(
    'phabricator_get_raw_diff',
    'Get the raw diff/patch content for a Differential diff by diff ID. Use phabricator_diff_search to find the diff ID from a revision PHID first.',
    {
      diffID: z.number().describe('The diff ID (numeric, e.g., 1392561). Use phabricator_diff_search to find this from a revision.'),
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
    'Search Differential diffs',
    {
      constraints: z.object({
        ids: z.array(z.number()).optional().describe('Diff IDs'),
        phids: z.array(z.string()).optional().describe('Diff PHIDs'),
        revisionPHIDs: z.array(z.string()).optional().describe('Revision PHIDs'),
      }).optional().describe('Search constraints'),
      attachments: z.object({
        commits: z.boolean().optional().describe('Include commit info'),
      }).optional().describe('Data attachments'),
      limit: z.number().max(100).optional().describe('Maximum results'),
      after: z.string().optional().describe('Pagination cursor'),
    },
    async (params) => {
      const result = await client.call('differential.diff.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Get comments from revision
  server.tool(
    'phabricator_revision_get_comments',
    'Fetch comments and transactions from a Differential revision using transaction.search',
    {
      objectIdentifier: z.string().describe('Revision PHID or ID (e.g., "D456")'),
      limit: z.number().max(100).optional().describe('Maximum number of transactions to return (default: 100)'),
    },
    async (params) => {
      // Resolve object identifier to PHID if needed
      let objectPHID: string;
      if (params.objectIdentifier.startsWith('PHID-')) {
        objectPHID = params.objectIdentifier;
      } else {
        const lookupResult = await client.call<Record<string, { phid: string }>>('phid.lookup', {
          names: [params.objectIdentifier],
        });
        const resolved = lookupResult[params.objectIdentifier];
        if (!resolved) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  { error: `Could not resolve object identifier: ${params.objectIdentifier}` },
                  null,
                  2,
                ),
              },
            ],
          };
        }
        objectPHID = resolved.phid;
      }

      const result = await client.call('transaction.search', {
        objectIdentifier: objectPHID,
        limit: params.limit || 100,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
