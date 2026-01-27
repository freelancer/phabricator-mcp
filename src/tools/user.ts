import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';

export function registerUserTools(server: McpServer, client: ConduitClient) {
  // Get current user
  server.tool(
    'phabricator_user_whoami',
    'Get information about the current authenticated user',
    {},
    async () => {
      const result = await client.call('user.whoami');
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Search users
  server.tool(
    'phabricator_user_search',
    'Search Phabricator users',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active", "approval"'),
      constraints: z.object({
        ids: z.array(z.number()).optional().describe('User IDs'),
        phids: z.array(z.string()).optional().describe('User PHIDs'),
        usernames: z.array(z.string()).optional().describe('Usernames'),
        nameLike: z.string().optional().describe('Name prefix search'),
        isAdmin: z.boolean().optional().describe('Filter by admin status'),
        isDisabled: z.boolean().optional().describe('Filter by disabled status'),
        isBot: z.boolean().optional().describe('Filter by bot status'),
        isMailingList: z.boolean().optional().describe('Filter by mailing list status'),
        query: z.string().optional().describe('Full-text search query'),
      }).optional().describe('Search constraints'),
      attachments: z.object({
        availability: z.boolean().optional().describe('Include availability info'),
      }).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.number().max(100).optional().describe('Maximum results'),
      after: z.string().optional().describe('Pagination cursor'),
    },
    async (params) => {
      const result = await client.call('user.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
