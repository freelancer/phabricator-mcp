import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonCoerce } from './coerce.js';
import { jsonResult } from './result.js';

export function registerConpherenceTools(server: McpServer, client: ConduitClient) {
  // Search chat rooms
  server.tool(
    'phabricator_conpherence_search',
    'Search Conpherence chat rooms/threads',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "participant"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('Room IDs'),
        phids: z.array(z.string()).optional().describe('Room PHIDs'),
        participants: z.array(z.string()).optional().describe('Participant user PHIDs'),
        fulltext: z.string().optional().describe('Search for rooms containing these words'),
      })).optional().describe('Search constraints'),
      order: z.string().optional().describe('Result order'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    async (params) => {
      const result = await client.call('conpherence.search', params);
      return jsonResult(result);
    },
  );

  // Read messages in a thread
  server.tool(
    'phabricator_conpherence_read',
    'Read messages from a Conpherence chat room/thread (returned in reverse chronological order). Uses conpherence.querytransaction (the only Conduit method that returns message content).',
    {
      roomID: z.coerce.number().optional().describe('Numeric room ID (provide this or roomPHID)'),
      roomPHID: z.string().optional().describe('Room PHID (provide this or roomID)'),
      limit: z.coerce.number().max(100).optional().describe('Maximum messages to return'),
      offset: z.coerce.number().optional().describe('Result offset for pagination'),
    },
    async (params) => {
      const result = await client.call('conpherence.querytransaction', {
        roomID: params.roomID,
        roomPHID: params.roomPHID,
        limit: params.limit,
        offset: params.offset,
      });
      return jsonResult(result);
    },
  );

  // Create a new thread
  server.tool(
    'phabricator_conpherence_create',
    'Create a new Conpherence chat room/thread',
    {
      title: z.string().describe('Thread title'),
      topic: z.string().optional().describe('Room topic/description'),
      message: z.string().optional().describe('Initial message (supports Remarkup)'),
      participantPHIDs: z.array(z.string()).optional().describe('Participant user PHIDs to add'),
    },
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [
        { type: 'name', value: params.title },
      ];

      if (params.topic !== undefined) {
        transactions.push({ type: 'topic', value: params.topic });
      }
      if (params.message !== undefined) {
        transactions.push({ type: 'comment', value: params.message });
      }
      if (params.participantPHIDs !== undefined) {
        transactions.push({ type: 'participants.add', value: params.participantPHIDs });
      }

      const result = await client.call('conpherence.edit', { transactions });
      return jsonResult(result);
    },
  );

  // Edit an existing thread
  server.tool(
    'phabricator_conpherence_edit',
    'Edit a Conpherence chat room/thread. Rename it or manage participants.',
    {
      objectIdentifier: z.string().describe('Room monogram (e.g., "Z123"), numeric ID, or PHID'),
      title: z.string().optional().describe('New room title'),
      topic: z.string().optional().describe('Room topic/description'),
      addParticipantPHIDs: z.array(z.string()).optional().describe('Participant PHIDs to add'),
      removeParticipantPHIDs: z.array(z.string()).optional().describe('Participant PHIDs to remove'),
      comment: z.string().optional().describe('Send a message alongside the edit (supports Remarkup)'),
    },
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [];

      if (params.title !== undefined) {
        transactions.push({ type: 'name', value: params.title });
      }
      if (params.topic !== undefined) {
        transactions.push({ type: 'topic', value: params.topic });
      }
      if (params.addParticipantPHIDs !== undefined) {
        transactions.push({ type: 'participants.add', value: params.addParticipantPHIDs });
      }
      if (params.removeParticipantPHIDs !== undefined) {
        transactions.push({ type: 'participants.remove', value: params.removeParticipantPHIDs });
      }
      if (params.comment !== undefined) {
        transactions.push({ type: 'comment', value: params.comment });
      }

      if (transactions.length === 0) {
        return { content: [{ type: 'text', text: 'No changes specified' }] };
      }

      const result = await client.call('conpherence.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions,
      });
      return jsonResult(result);
    },
  );

  // Send a message
  server.tool(
    'phabricator_conpherence_send',
    'Send a message to a Conpherence chat room/thread',
    {
      objectIdentifier: z.string().describe('Room monogram (e.g., "Z123"), numeric ID, or PHID'),
      message: z.string().describe('Message text (supports Remarkup)'),
    },
    async (params) => {
      const result = await client.call('conpherence.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions: [{ type: 'comment', value: params.message }],
      });
      return jsonResult(result);
    },
  );
}
