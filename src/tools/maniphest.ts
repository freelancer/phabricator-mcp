import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';

export function registerManiphestTools(server: McpServer, client: ConduitClient) {
  // Search tasks
  server.tool(
    'phabricator_task_search',
    'Search Maniphest tasks with optional filters',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "open", "authored", "assigned"'),
      constraints: z.object({
        ids: z.array(z.number()).optional().describe('Task IDs to search for'),
        phids: z.array(z.string()).optional().describe('Task PHIDs to search for'),
        assigned: z.array(z.string()).optional().describe('Assigned user PHIDs'),
        authorPHIDs: z.array(z.string()).optional().describe('Author PHIDs'),
        statuses: z.array(z.string()).optional().describe('Task statuses: open, resolved, wontfix, invalid, spite, duplicate'),
        priorities: z.array(z.number()).optional().describe('Priority levels'),
        subtypes: z.array(z.string()).optional().describe('Task subtypes'),
        columnPHIDs: z.array(z.string()).optional().describe('Workboard column PHIDs'),
        projectPHIDs: z.array(z.string()).optional().describe('Project PHIDs (tasks tagged with these projects)'),
        query: z.string().optional().describe('Full-text search query'),
      }).optional().describe('Search constraints'),
      attachments: z.object({
        columns: z.boolean().optional().describe('Include workboard column info'),
        projects: z.boolean().optional().describe('Include project info'),
        subscribers: z.boolean().optional().describe('Include subscriber info'),
      }).optional().describe('Data attachments to include'),
      order: z.string().optional().describe('Result order: "priority", "updated", "newest", "oldest"'),
      limit: z.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for pagination'),
    },
    async (params) => {
      const result = await client.call('maniphest.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Create task
  server.tool(
    'phabricator_task_create',
    'Create a new Maniphest task',
    {
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task description (supports Remarkup)'),
      ownerPHID: z.string().optional().describe('Assigned owner PHID'),
      priority: z.string().optional().describe('Priority: unbreak, triage, high, normal, low, wish'),
      projectPHIDs: z.array(z.string()).optional().describe('Project PHIDs to tag'),
      subscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs'),
      status: z.string().optional().describe('Initial status'),
    },
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [
        { type: 'title', value: params.title },
      ];

      if (params.description !== undefined) {
        transactions.push({ type: 'description', value: params.description });
      }
      if (params.ownerPHID !== undefined) {
        transactions.push({ type: 'owner', value: params.ownerPHID });
      }
      if (params.priority !== undefined) {
        transactions.push({ type: 'priority', value: params.priority });
      }
      if (params.projectPHIDs !== undefined) {
        transactions.push({ type: 'projects.set', value: params.projectPHIDs });
      }
      if (params.subscriberPHIDs !== undefined) {
        transactions.push({ type: 'subscribers.set', value: params.subscriberPHIDs });
      }
      if (params.status !== undefined) {
        transactions.push({ type: 'status', value: params.status });
      }

      const result = await client.call('maniphest.edit', { transactions });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Edit task
  server.tool(
    'phabricator_task_edit',
    'Edit an existing Maniphest task',
    {
      objectIdentifier: z.string().describe('Task PHID or ID (e.g., "T123" or PHID)'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      ownerPHID: z.string().nullable().optional().describe('New owner PHID (null to unassign)'),
      priority: z.string().optional().describe('New priority'),
      status: z.string().optional().describe('New status: open, resolved, wontfix, invalid, spite, duplicate'),
      addProjectPHIDs: z.array(z.string()).optional().describe('Project PHIDs to add'),
      removeProjectPHIDs: z.array(z.string()).optional().describe('Project PHIDs to remove'),
      addSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to add'),
      removeSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to remove'),
      columnPHID: z.string().optional().describe('Move to workboard column'),
    },
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [];

      if (params.title !== undefined) {
        transactions.push({ type: 'title', value: params.title });
      }
      if (params.description !== undefined) {
        transactions.push({ type: 'description', value: params.description });
      }
      if (params.ownerPHID !== undefined) {
        transactions.push({ type: 'owner', value: params.ownerPHID });
      }
      if (params.priority !== undefined) {
        transactions.push({ type: 'priority', value: params.priority });
      }
      if (params.status !== undefined) {
        transactions.push({ type: 'status', value: params.status });
      }
      if (params.addProjectPHIDs !== undefined) {
        transactions.push({ type: 'projects.add', value: params.addProjectPHIDs });
      }
      if (params.removeProjectPHIDs !== undefined) {
        transactions.push({ type: 'projects.remove', value: params.removeProjectPHIDs });
      }
      if (params.addSubscriberPHIDs !== undefined) {
        transactions.push({ type: 'subscribers.add', value: params.addSubscriberPHIDs });
      }
      if (params.removeSubscriberPHIDs !== undefined) {
        transactions.push({ type: 'subscribers.remove', value: params.removeSubscriberPHIDs });
      }
      if (params.columnPHID !== undefined) {
        transactions.push({ type: 'column', value: [params.columnPHID] });
      }

      if (transactions.length === 0) {
        return { content: [{ type: 'text', text: 'No changes specified' }] };
      }

      const result = await client.call('maniphest.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Add comment to task
  server.tool(
    'phabricator_task_add_comment',
    'Add a comment to a Maniphest task',
    {
      objectIdentifier: z.string().describe('Task PHID or ID (e.g., "T123")'),
      comment: z.string().describe('Comment text (supports Remarkup)'),
    },
    async (params) => {
      const result = await client.call('maniphest.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions: [{ type: 'comment', value: params.comment }],
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
