import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonResult } from './result.js';
import { ADDITIVE, DESTRUCTIVE, READ_ONLY } from './annotations.js';

export function registerConpherenceTools(server: McpServer, client: ConduitClient) {
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
    READ_ONLY,
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
    'Create a Conpherence room; you are always a participant.',
    {
      title: z.string().describe('Thread title'),
      topic: z.string().optional().describe('Room topic/description'),
      message: z.string().optional().describe('Initial message (supports Remarkup)'),
      participantPHIDs: z.array(z.string()).optional().describe('Other participants\' PHIDs'),
    },
    ADDITIVE,
    async (params) => {
      // Phabricator rejects a message in the call that creates the room.
      const viewer = await client.call<{ phid: string }>('user.whoami');
      const participants = [...new Set([viewer.phid, ...(params.participantPHIDs ?? [])])];
      const transactions: Array<{ type: string; value: unknown }> = [
        { type: 'name', value: params.title },
      ];
      if (params.topic !== undefined) {
        transactions.push({ type: 'topic', value: params.topic });
      }
      transactions.push({ type: 'participants.add', value: participants });

      const result = await client.call<{ object: { phid: string } }>('conpherence.edit', { transactions });
      if (params.message === undefined) {
        return jsonResult(result);
      }
      try {
        const message = await client.call('conpherence.edit', {
          objectIdentifier: result.object.phid,
          transactions: [{ type: 'comment', value: params.message }],
        });
        return jsonResult({ ...result, message });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Created room ${result.object.phid}, but posting the message failed: ${reason}`);
      }
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
    DESTRUCTIVE,
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
    ADDITIVE,
    async (params) => {
      const result = await client.call('conpherence.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions: [{ type: 'comment', value: params.message }],
      });
      return jsonResult(result);
    },
  );
}
