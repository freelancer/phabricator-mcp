import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonCoerce } from './coerce.js';
import { jsonResult } from './result.js';
import { ADDITIVE, DESTRUCTIVE, READ_ONLY } from './annotations.js';

export function registerPasteTools(server: McpServer, client: ConduitClient) {
  // Search pastes
  server.tool(
    'phabricator_paste_search',
    'Search Phabricator pastes',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active", "authored"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('Paste IDs'),
        phids: z.array(z.string()).optional().describe('Paste PHIDs'),
        authors: z.array(z.string()).optional().describe('Author PHIDs'),
        languages: z.array(z.string()).optional().describe('Languages'),
        statuses: z.array(z.string()).optional().describe('Statuses: active, archived'),
        subscribers: z.array(z.string()).optional().describe('Subscriber user/project PHIDs'),
        projects: z.array(z.string()).optional().describe('Project PHIDs'),
        spaces: z.array(z.string()).optional().describe('Space PHIDs (for multi-space installations)'),
        createdStart: z.coerce.number().optional().describe('Created after (epoch timestamp)'),
        createdEnd: z.coerce.number().optional().describe('Created before (epoch timestamp)'),
        query: z.string().optional().describe('Full-text search query'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
        content: z.boolean().optional().describe('Include paste content'),
        subscribers: z.boolean().optional().describe('Include subscriber details'),
        projects: z.boolean().optional().describe('Include tagged projects'),
      })).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    READ_ONLY,
    async (params) => {
      const result = await client.call('paste.search', params);
      return jsonResult(result);
    },
  );

  // Create paste
  server.tool(
    'phabricator_paste_create',
    'Create a new Phabricator paste',
    {
      title: z.string().optional().describe('Paste title'),
      content: z.string().describe('Paste content'),
      language: z.string().optional().describe('Syntax highlighting language'),
      status: z.string().optional().describe('Status: active or archived'),
      addSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to add'),
      addProjectPHIDs: z.array(z.string()).optional().describe('Project PHIDs to tag'),
    },
    ADDITIVE,
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [
        { type: 'text', value: params.content },
      ];

      if (params.title !== undefined) {
        transactions.push({ type: 'title', value: params.title });
      }
      if (params.language !== undefined) {
        transactions.push({ type: 'language', value: params.language });
      }
      if (params.status !== undefined) {
        transactions.push({ type: 'status', value: params.status });
      }
      if (params.addSubscriberPHIDs !== undefined) {
        transactions.push({ type: 'subscribers.add', value: params.addSubscriberPHIDs });
      }
      if (params.addProjectPHIDs !== undefined) {
        transactions.push({ type: 'projects.add', value: params.addProjectPHIDs });
      }

      const result = await client.call('paste.edit', { transactions });
      return jsonResult(result);
    },
  );

  // Edit paste
  server.tool(
    'phabricator_paste_edit',
    'Edit an existing Phabricator paste',
    {
      objectIdentifier: z.string().describe('Paste PHID or ID (e.g., "P123")'),
      title: z.string().optional().describe('New title'),
      content: z.string().optional().describe('New content'),
      language: z.string().optional().describe('Syntax highlighting language'),
      status: z.string().optional().describe('Status: active or archived'),
      addSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to add'),
      removeSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to remove'),
      addProjectPHIDs: z.array(z.string()).optional().describe('Project PHIDs to add'),
      removeProjectPHIDs: z.array(z.string()).optional().describe('Project PHIDs to remove'),
      comment: z.string().optional().describe('Add a comment alongside the edit (supports Remarkup)'),
    },
    DESTRUCTIVE,
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [];

      if (params.title !== undefined) {
        transactions.push({ type: 'title', value: params.title });
      }
      if (params.content !== undefined) {
        transactions.push({ type: 'text', value: params.content });
      }
      if (params.language !== undefined) {
        transactions.push({ type: 'language', value: params.language });
      }
      if (params.status !== undefined) {
        transactions.push({ type: 'status', value: params.status });
      }
      if (params.addSubscriberPHIDs !== undefined) {
        transactions.push({ type: 'subscribers.add', value: params.addSubscriberPHIDs });
      }
      if (params.removeSubscriberPHIDs !== undefined) {
        transactions.push({ type: 'subscribers.remove', value: params.removeSubscriberPHIDs });
      }
      if (params.addProjectPHIDs !== undefined) {
        transactions.push({ type: 'projects.add', value: params.addProjectPHIDs });
      }
      if (params.removeProjectPHIDs !== undefined) {
        transactions.push({ type: 'projects.remove', value: params.removeProjectPHIDs });
      }
      if (params.comment !== undefined) {
        transactions.push({ type: 'comment', value: params.comment });
      }

      if (transactions.length === 0) {
        return { content: [{ type: 'text', text: 'No changes specified' }] };
      }

      const result = await client.call('paste.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions,
      });
      return jsonResult(result);
    },
  );
}
