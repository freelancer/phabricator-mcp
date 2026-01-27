import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';

export function registerPasteTools(server: McpServer, client: ConduitClient) {
  // Search pastes
  server.tool(
    'phabricator_paste_search',
    'Search Phabricator pastes',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "authored"'),
      constraints: z.object({
        ids: z.array(z.number()).optional().describe('Paste IDs'),
        phids: z.array(z.string()).optional().describe('Paste PHIDs'),
        authorPHIDs: z.array(z.string()).optional().describe('Author PHIDs'),
        languages: z.array(z.string()).optional().describe('Languages'),
        query: z.string().optional().describe('Full-text search query'),
      }).optional().describe('Search constraints'),
      attachments: z.object({
        content: z.boolean().optional().describe('Include paste content'),
      }).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.number().max(100).optional().describe('Maximum results'),
      after: z.string().optional().describe('Pagination cursor'),
    },
    async (params) => {
      const result = await client.call('paste.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Create paste
  server.tool(
    'phabricator_paste_create',
    'Create a new Phabricator paste',
    {
      title: z.string().optional().describe('Paste title'),
      content: z.string().describe('Paste content'),
      language: z.string().optional().describe('Syntax highlighting language'),
      status: z.string().optional().describe('Status: active or archived'),
    },
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [
        { type: 'text', value: params.content },
      ];

      if (params.title !== undefined) {
        transactions.push({ type: 'title', value: params.title });
      }
      if (params.language !== undefined) {
        transactions.push({ type: 'language', value: params.language });
      }
      if (params.status !== undefined) {
        transactions.push({ type: 'status', value: params.status });
      }

      const result = await client.call('paste.edit', { transactions });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
