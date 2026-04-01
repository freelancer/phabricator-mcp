import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonCoerce } from './coerce.js';

export function registerProjectTools(server: McpServer, client: ConduitClient) {
  // Search projects
  server.tool(
    'phabricator_project_search',
    'Search Phabricator projects',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active" (non-archived), "joined", "watching"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('Project IDs'),
        phids: z.array(z.string()).optional().describe('Project PHIDs'),
        slugs: z.array(z.string()).optional().describe('Project slugs'),
        name: z.string().optional().describe('Name substring search'),
        status: z.enum(['active', 'archived', 'all']).optional().describe('Project status: "active", "archived", or "all"'),
        members: z.array(z.string()).optional().describe('Member user PHIDs'),
        watchers: z.array(z.string()).optional().describe('Watcher user PHIDs'),
        ancestors: z.array(z.string()).optional().describe('Ancestor project PHIDs'),
        parents: z.array(z.string()).optional().describe('Parent project PHIDs (find subprojects)'),
        icons: z.array(z.string()).optional().describe('Filter by project icon'),
        isMilestone: z.boolean().optional().describe('Filter milestones'),
        isRoot: z.boolean().optional().describe('Filter root projects'),
        minDepth: z.coerce.number().optional().describe('Minimum project depth (0 = root)'),
        maxDepth: z.coerce.number().optional().describe('Maximum project depth'),
        subtypes: z.array(z.string()).optional().describe('Project subtypes'),
        colors: z.array(z.string()).optional().describe('Project colors'),
        spaces: z.array(z.string()).optional().describe('Space PHIDs (for multi-space installations)'),
        query: z.string().optional().describe('Full-text search query'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
        members: z.boolean().optional().describe('Include members'),
        watchers: z.boolean().optional().describe('Include watchers'),
        ancestors: z.boolean().optional().describe('Include ancestors'),
      })).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    async (params) => {
      const result = await client.call('project.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Edit project
  server.tool(
    'phabricator_project_edit',
    'Create or edit a Phabricator project. Omit objectIdentifier to create a new project (name is required for creation).',
    {
      objectIdentifier: z.string().optional().describe('Project PHID or ID. Omit to create a new project.'),
      name: z.string().optional().describe('New name'),
      description: z.string().optional().describe('Project description (supports Remarkup)'),
      icon: z.string().optional().describe('New icon'),
      color: z.string().optional().describe('New color'),
      addMemberPHIDs: z.array(z.string()).optional().describe('Add members'),
      removeMemberPHIDs: z.array(z.string()).optional().describe('Remove members'),
      space: z.string().optional().describe('Space PHID (for multi-space installations)'),
      parent: z.string().optional().describe('Parent project PHID (to create as a subproject)'),
      milestone: z.string().optional().describe('Parent project PHID (to create as a milestone of that project)'),
      slug: z.string().optional().describe('Project URL slug (replaces ALL existing slugs with this one)'),
    },
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [];

      if (params.name !== undefined) {
        transactions.push({ type: 'name', value: params.name });
      }
      if (params.description !== undefined) {
        transactions.push({ type: 'description', value: params.description });
      }
      if (params.space !== undefined) {
        transactions.push({ type: 'space', value: params.space });
      }
      if (params.parent !== undefined) {
        transactions.push({ type: 'parent', value: params.parent });
      }
      if (params.milestone !== undefined) {
        transactions.push({ type: 'milestone', value: params.milestone });
      }
      if (params.slug !== undefined) {
        transactions.push({ type: 'slugs', value: [params.slug] });
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

      const apiParams: Record<string, unknown> = { transactions };
      if (params.objectIdentifier !== undefined) {
        apiParams.objectIdentifier = params.objectIdentifier;
      }
      const result = await client.call('project.edit', apiParams);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Search workboard columns
  server.tool(
    'phabricator_column_search',
    'Search project workboard columns',
    {
      queryKey: z.string().optional().describe('Built-in query: "all"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('Column IDs'),
        phids: z.array(z.string()).optional().describe('Column PHIDs'),
        projects: z.array(z.string()).optional().describe('Project PHIDs'),
      })).optional().describe('Search constraints'),
      order: z.string().optional().describe('Result order'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    async (params) => {
      const result = await client.call('project.column.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
