import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';

export function registerDiffusionTools(server: McpServer, client: ConduitClient) {
  // Search repositories
  server.tool(
    'phabricator_repository_search',
    'Search Diffusion repositories',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active"'),
      constraints: z.object({
        ids: z.array(z.number()).optional().describe('Repository IDs'),
        phids: z.array(z.string()).optional().describe('Repository PHIDs'),
        callsigns: z.array(z.string()).optional().describe('Repository callsigns'),
        shortNames: z.array(z.string()).optional().describe('Repository short names'),
        types: z.array(z.string()).optional().describe('VCS types: git, hg, svn'),
        uris: z.array(z.string()).optional().describe('Repository URIs'),
        query: z.string().optional().describe('Full-text search query'),
      }).optional().describe('Search constraints'),
      attachments: z.object({
        uris: z.boolean().optional().describe('Include repository URIs'),
        metrics: z.boolean().optional().describe('Include metrics'),
        projects: z.boolean().optional().describe('Include projects'),
      }).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.number().max(100).optional().describe('Maximum results'),
      after: z.string().optional().describe('Pagination cursor'),
    },
    async (params) => {
      const result = await client.call('diffusion.repository.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Search commits
  server.tool(
    'phabricator_commit_search',
    'Search Diffusion commits',
    {
      constraints: z.object({
        ids: z.array(z.number()).optional().describe('Commit IDs'),
        phids: z.array(z.string()).optional().describe('Commit PHIDs'),
        repositoryPHIDs: z.array(z.string()).optional().describe('Repository PHIDs'),
        identifiers: z.array(z.string()).optional().describe('Commit identifiers (hashes)'),
        authorPHIDs: z.array(z.string()).optional().describe('Author PHIDs'),
        query: z.string().optional().describe('Full-text search query'),
      }).optional().describe('Search constraints'),
      attachments: z.object({
        projects: z.boolean().optional().describe('Include projects'),
        subscribers: z.boolean().optional().describe('Include subscribers'),
      }).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.number().max(100).optional().describe('Maximum results'),
      after: z.string().optional().describe('Pagination cursor'),
    },
    async (params) => {
      const result = await client.call('diffusion.commit.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
