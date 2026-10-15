import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonResult } from './result.js';

export function registerAuditTools(server: McpServer, client: ConduitClient) {
  // Query audits
  server.tool(
    'phabricator_audit_query',
    'Search commit audit requests using the legacy audit.query endpoint. For most use cases, prefer phabricator_commit_search with the auditors attachment. This frozen endpoint provides audit-specific status filtering not available in the modern API.',
    {
      auditorPHIDs: z.array(z.string()).optional().describe('Auditor user/project PHIDs'),
      commitPHIDs: z.array(z.string()).optional().describe('Commit PHIDs to check audit status for'),
      status: z.string().optional().describe('Audit status filter: "audit-status-any" (default), "audit-status-open", "audit-status-concern", "audit-status-accepted", "audit-status-partial"'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      offset: z.coerce.number().optional().describe('Result offset for pagination'),
    },
    async (params) => {
      const result = await client.call('audit.query', params);
      return jsonResult(result);
    },
  );
}
