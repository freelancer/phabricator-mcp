import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonCoerce } from './coerce.js';
import { jsonResult } from './result.js';

export function registerPhrictionTools(server: McpServer, client: ConduitClient) {
  // Search wiki documents
  server.tool(
    'phabricator_document_search',
    'Search Phriction wiki documents',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('Document IDs'),
        phids: z.array(z.string()).optional().describe('Document PHIDs'),
        paths: z.array(z.string()).optional().describe('Document paths'),
        parentPaths: z.array(z.string()).optional().describe('Parent paths (direct children only)'),
        ancestorPaths: z.array(z.string()).optional().describe('Ancestor paths to search under (any depth)'),
        statuses: z.array(z.string()).optional().describe('Document statuses'),
        subscribers: z.array(z.string()).optional().describe('Subscriber user/project PHIDs'),
        projects: z.array(z.string()).optional().describe('Project PHIDs'),
        spaces: z.array(z.string()).optional().describe('Space PHIDs (for multi-space installations)'),
        query: z.string().optional().describe('Full-text search query'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
        content: z.boolean().optional().describe('Include document content'),
        subscribers: z.boolean().optional().describe('Include subscriber details'),
        projects: z.boolean().optional().describe('Include tagged projects'),
      })).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    async (params) => {
      const result = await client.call('phriction.document.search', params);
      return jsonResult(result);
    },
  );

  // Create wiki document
  server.tool(
    'phabricator_document_create',
    'Create a new Phriction wiki document. Uses phriction.create (the only method that can create documents).',
    {
      slug: z.string().describe('Document slug/path (e.g., "projects/myproject/")'),
      title: z.string().describe('Document title'),
      content: z.string().describe('Document content (Remarkup)'),
      description: z.string().optional().describe('Edit description/summary'),
    },
    async (params) => {
      const result = await client.call('phriction.create', params);
      return jsonResult(result);
    },
  );

  // Edit wiki document content
  server.tool(
    'phabricator_document_edit',
    'Edit an existing Phriction wiki document title or content. Uses phriction.edit (the only method that can update document content).',
    {
      slug: z.string().describe('Document slug/path (e.g., "projects/myproject/")'),
      title: z.string().optional().describe('New document title'),
      content: z.string().optional().describe('New document content (Remarkup)'),
      description: z.string().optional().describe('Edit description/summary'),
    },
    async (params) => {
      const result = await client.call('phriction.edit', params);
      return jsonResult(result);
    },
  );

  // Add comment to document
  server.tool(
    'phabricator_document_add_comment',
    'Add a comment to a Phriction wiki document',
    {
      objectIdentifier: z.string().describe('Document slug, PHID, or ID (e.g., "projects/myproject/")'),
      comment: z.string().describe('Comment text (supports Remarkup)'),
    },
    async (params) => {
      const result = await client.call('phriction.document.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions: [{ type: 'comment', value: params.comment }],
      });
      return jsonResult(result);
    },
  );
}
