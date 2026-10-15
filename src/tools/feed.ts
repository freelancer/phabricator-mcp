import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonResult } from './result.js';
import { READ_ONLY } from './annotations.js';

export function registerFeedTools(server: McpServer, client: ConduitClient) {
  // Query activity feed
  server.tool(
    'phabricator_feed_query',
    'Query the Phabricator activity feed. Returns recent activity (task updates, revision changes, commits, etc.) as an object keyed by story PHID. Uses feed.query (the only Conduit method for feed data).',
    {
      filterPHIDs: z.array(z.string()).optional().describe('Only show activity involving these PHIDs (user, project, task, etc.)'),
      view: z.enum(['data', 'text', 'html', 'html-summary']).optional().describe('Output format: "data" (structured, default), "text" (human-readable), "html" (rendered HTML), "html-summary" (title only)'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.coerce.string().optional().describe('chronologicalKey (string): return older stories'),
      before: z.coerce.string().optional().describe('chronologicalKey (string): return newer stories'),
    },
    READ_ONLY,
    async (params) => {
      const result = await client.call('feed.query', params);
      return jsonResult(result);
    },
  );
}
