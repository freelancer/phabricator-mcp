import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonResult } from './result.js';

export function registerPhidTools(server: McpServer, client: ConduitClient) {
  // Lookup PHIDs by name
  server.tool(
    'phabricator_phid_lookup',
    'Look up PHIDs by human-readable names (e.g., "T123", "D456", "@username")',
    {
      names: z.array(z.string()).describe('Names to look up (e.g., ["T123", "D456", "@john"])'),
    },
    async (params) => {
      const result = await client.call('phid.lookup', { names: params.names });
      return jsonResult(result);
    },
  );

  // Query PHID details
  server.tool(
    'phabricator_phid_query',
    'Get handle information (name, URI, type, status) for PHIDs. For full object data, use application-specific search tools (e.g., phabricator_task_search, phabricator_revision_search).',
    {
      phids: z.array(z.string()).describe('PHIDs to query'),
    },
    async (params) => {
      const result = await client.call('phid.query', { phids: params.phids });
      return jsonResult(result);
    },
  );
}
