import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonCoerce } from './coerce.js';
import { jsonResult } from './result.js';

export function registerUserTools(server: McpServer, client: ConduitClient) {
  // Get current user
  server.tool(
    'phabricator_user_whoami',
    'Get information about the current authenticated user',
    {},
    async () => {
      const result = await client.call('user.whoami');
      return jsonResult(result);
    },
  );

  // Search users
  server.tool(
    'phabricator_user_search',
    'Search Phabricator users',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active", "approval"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('User IDs'),
        phids: z.array(z.string()).optional().describe('User PHIDs'),
        usernames: z.array(z.string()).optional().describe('Usernames'),
        nameLike: z.string().optional().describe('Name prefix search'),
        isAdmin: z.boolean().optional().describe('Filter by admin status'),
        isDisabled: z.boolean().optional().describe('Filter by disabled status'),
        isBot: z.boolean().optional().describe('Filter by bot status'),
        isMailingList: z.boolean().optional().describe('Filter by mailing list status'),
        needsApproval: z.boolean().optional().describe('Filter to users awaiting admin approval'),
        mfa: z.boolean().optional().describe('Filter by MFA enrollment status (admin-only)'),
        createdStart: z.coerce.number().optional().describe('Created after (epoch timestamp)'),
        createdEnd: z.coerce.number().optional().describe('Created before (epoch timestamp)'),
        query: z.string().optional().describe('Full-text search query'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
        availability: z.boolean().optional().describe('Include availability info'),
      })).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    async (params) => {
      const result = await client.call('user.search', params);
      return jsonResult(result);
    },
  );
}
