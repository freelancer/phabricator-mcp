import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonCoerce } from './coerce.js';
import { jsonResult } from './result.js';
import { ADDITIVE, READ_ONLY } from './annotations.js';

export function registerFileTools(server: McpServer, client: ConduitClient) {
  // Upload a file
  server.tool(
    'phabricator_file_upload',
    'Upload a file to Phabricator. Returns a file PHID that can be used with phabricator_file_info to get the file ID for embedding in Remarkup via {F<id>}.',
    {
      name: z.string().optional().describe('Filename with extension (e.g. "screenshot.png")'),
      data_base64: z.string().describe('Base64-encoded file content'),
      viewPolicy: z.string().optional().describe('File visibility policy (e.g., "public", "users", or a custom policy PHID)'),
      canCDN: z.boolean().optional().describe('Whether the file can be served over CDN (for public assets)'),
    },
    ADDITIVE,
    async (params) => {
      const apiParams: Record<string, unknown> = {
        data_base64: params.data_base64,
      };
      if (params.name !== undefined) {
        apiParams.name = params.name;
      }
      if (params.viewPolicy !== undefined) {
        apiParams.viewPolicy = params.viewPolicy;
      }
      if (params.canCDN !== undefined) {
        apiParams.canCDN = params.canCDN;
      }
      const phid = await client.call<string>('file.upload', apiParams);
      return { content: [{ type: 'text', text: phid }] };
    },
  );

  // Search files
  server.tool(
    'phabricator_file_search',
    'Search for files in Phabricator',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "authored"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('File IDs'),
        phids: z.array(z.string()).optional().describe('File PHIDs'),
        authorPHIDs: z.array(z.string()).optional().describe('Author PHIDs'),
        name: z.string().optional().describe('File name substring search'),
        createdStart: z.coerce.number().optional().describe('Created after (epoch timestamp)'),
        createdEnd: z.coerce.number().optional().describe('Created before (epoch timestamp)'),
        explicit: z.boolean().optional().describe('Filter to explicitly uploaded files only'),
        subscribers: z.array(z.string()).optional().describe('Subscriber user/project PHIDs'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
        subscribers: z.boolean().optional().describe('Include subscriber details'),
      })).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    READ_ONLY,
    async (params) => {
      const result = await client.call('file.search', params);
      return jsonResult(result);
    },
  );

  // Get file info
  server.tool(
    'phabricator_file_info',
    'Get metadata about a file (name, size, MIME type, URI). Use the returned URI to download. Provide at least one of id or phid. Uses file.info (the only Conduit method that returns download URIs).',
    {
      id: z.coerce.number().optional().describe('File ID (provide this or phid)'),
      phid: z.string().optional().describe('File PHID (provide this or id)'),
    },
    READ_ONLY,
    async (params) => {
      const result = await client.call('file.info', params);
      return jsonResult(result);
    },
  );
}
