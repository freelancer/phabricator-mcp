import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';

export function registerProjectTools(server: McpServer, client: ConduitClient) {
  // Search projects
  server.tool(
    'phabricator_project_search',
    'Search Phabricator projects',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active", "joined"'),
      constraints: z.object({
        ids: z.array(z.number()).optional().describe('Project IDs'),
        phids: z.array(z.string()).optional().describe('Project PHIDs'),
        slugs: z.array(z.string()).optional().describe('Project slugs'),
        name: z.string().optional().describe('Exact name match'),
        members: z.array(z.string()).optional().describe('Member user PHIDs'),
        watchers: z.array(z.string()).optional().describe('Watcher user PHIDs'),
        ancestors: z.array(z.string()).optional().describe('Ancestor project PHIDs'),
        isMilestone: z.boolean().optional().describe('Filter milestones'),
        isRoot: z.boolean().optional().describe('Filter root projects'),
        query: z.string().optional().describe('Full-text search query'),
      }).optional().describe('Search constraints'),
      attachments: z.object({
        members: z.boolean().optional().describe('Include members'),
        watchers: z.boolean().optional().describe('Include watchers'),
        ancestors: z.boolean().optional().describe('Include ancestors'),
      }).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.number().max(100).optional().describe('Maximum results'),
      after: z.string().optional().describe('Pagination cursor'),
    },
    async (params) => {
      const result = await client.call('project.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Edit project
  server.tool(
    'phabricator_project_edit',
    'Edit a Phabricator project',
    {
      objectIdentifier: z.string().describe('Project PHID or ID'),
      name: z.string().optional().describe('New name'),
      description: z.string().optional().describe('New description'),
      icon: z.string().optional().describe('New icon'),
      color: z.string().optional().describe('New color'),
      addMemberPHIDs: z.array(z.string()).optional().describe('Add members'),
      removeMemberPHIDs: z.array(z.string()).optional().describe('Remove members'),
    },
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [];

      if (params.name !== undefined) {
        transactions.push({ type: 'name', value: params.name });
      }
      if (params.description !== undefined) {
        transactions.push({ type: 'description', value: params.description });
      }
      if (params.icon !== undefined) {
        transactions.push({ type: 'icon', value: params.icon });
      }
      if (params.color !== undefined) {
        transactions.push({ type: 'color', value: params.color });
      }
      if (params.addMemberPHIDs !== undefined) {
        transactions.push({ type: 'members.add', value: params.addMemberPHIDs });
      }
      if (params.removeMemberPHIDs !== undefined) {
        transactions.push({ type: 'members.remove', value: params.removeMemberPHIDs });
      }

      if (transactions.length === 0) {
        return { content: [{ type: 'text', text: 'No changes specified' }] };
      }

      const result = await client.call('project.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Search workboard columns
  server.tool(
    'phabricator_column_search',
    'Search project workboard columns',
    {
      constraints: z.object({
        ids: z.array(z.number()).optional().describe('Column IDs'),
        phids: z.array(z.string()).optional().describe('Column PHIDs'),
        projects: z.array(z.string()).optional().describe('Project PHIDs'),
      }).optional().describe('Search constraints'),
      order: z.string().optional().describe('Result order'),
      limit: z.number().max(100).optional().describe('Maximum results'),
      after: z.string().optional().describe('Pagination cursor'),
    },
    async (params) => {
      const result = await client.call('project.column.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
