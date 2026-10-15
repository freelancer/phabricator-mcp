import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonCoerce } from './coerce.js';
import { jsonResult } from './result.js';
import { READ_ONLY } from './annotations.js';

export function registerTransactionTools(server: McpServer, client: ConduitClient) {
  server.tool(
    'phabricator_transaction_search',
    'Search transactions (comments, status changes, etc.) on a Phabricator object (e.g., "D123", "T456")',
    {
      objectIdentifier: z.string().describe('Object ID (e.g., "D123", "T456") or PHID to get transactions for'),
      constraints: jsonCoerce(z.object({
        phids: z.array(z.string()).optional().describe('Transaction PHIDs'),
        authorPHIDs: z.array(z.string()).optional().describe('Author PHIDs'),
      })).optional().describe('Search constraints'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    READ_ONLY,
    async (params) => {
      const result = await client.call('transaction.search', params);
      return jsonResult(result);
    },
  );
}
