import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonCoerce } from './coerce.js';

/**
 * Resolve revision identifiers (e.g. "D223125", "PHID-DREV-xxx") to PHIDs.
 * Accepts a mix of D-prefixed IDs and raw PHIDs.
 */
async function resolveRevisionPHIDs(client: ConduitClient, ids: string[]): Promise<string[]> {
  const phids: string[] = [];
  const namesToLookup: string[] = [];

  for (const id of ids) {
    if (id.startsWith('PHID-')) {
      phids.push(id);
    } else {
      // Normalize to D-prefixed format if just a number
      const name = /^\d+$/.test(id) ? `D${id}` : id;
      namesToLookup.push(name);
    }
  }

  if (namesToLookup.length > 0) {
    const lookupResult = await client.call<Record<string, { phid: string }>>(
      'phid.lookup',
      { names: namesToLookup },
    );
    for (const name of namesToLookup) {
      const entry = lookupResult[name];
      if (entry) {
        phids.push(entry.phid);
      } else {
        throw new Error(`Could not resolve revision identifier: ${name}`);
      }
    }
  }

  return phids;
}

/**
 * Link or unlink revisions to/from a task by calling differential.revision.edit
 * with tasks.add / tasks.remove transactions.
 */
async function linkRevisionsToTask(
  client: ConduitClient,
  taskIdentifier: string,
  revisionPHIDs: string[],
  action: 'add' | 'remove',
): Promise<unknown[]> {
  // Resolve the task identifier to a PHID if it's a T-prefixed ID
  let taskPHID = taskIdentifier;
  if (!taskIdentifier.startsWith('PHID-')) {
    const lookupResult = await client.call<Record<string, { phid: string }>>(
      'phid.lookup',
      { names: [taskIdentifier] },
    );
    const entry = lookupResult[taskIdentifier];
    if (entry) {
      taskPHID = entry.phid;
    } else {
      throw new Error(`Could not resolve task identifier: ${taskIdentifier}`);
    }
  }

  const results: unknown[] = [];
  for (const revPHID of revisionPHIDs) {
    const result = await client.call('differential.revision.edit', {
      objectIdentifier: revPHID,
      transactions: [{ type: `tasks.${action}`, value: [taskPHID] }],
    });
    results.push(result);
  }
  return results;
}

/**
 * Phabricator custom fields are only editable when the task's subtype matches
 * the form that exposes them. For example, `custom.postmortem.*` fields require
 * subtype "postmortem", while `custom.incident.*` fields require "incident".
 *
 * This function groups custom field transactions by required subtype, temporarily
 * switches the task's subtype to set each group, then restores the original subtype.
 */
const SUBTYPE_FIELD_PREFIXES: Record<string, string> = {
  'custom.postmortem.': 'postmortem',
  'custom.incident.': 'incident',
};

async function applyCustomFields(
  client: ConduitClient,
  objectIdentifier: string,
  customFields: Record<string, unknown>,
  currentSubtype?: string,
): Promise<unknown> {
  // Group fields by required subtype
  const groups = new Map<string | null, Array<{ type: string; value: unknown }>>();

  for (const [key, value] of Object.entries(customFields)) {
    let requiredSubtype: string | null = null;
    for (const [prefix, subtype] of Object.entries(SUBTYPE_FIELD_PREFIXES)) {
      if (key.startsWith(prefix)) {
        requiredSubtype = subtype;
        break;
      }
    }
    const group = groups.get(requiredSubtype) ?? [];
    group.push({ type: key, value });
    groups.set(requiredSubtype, group);
  }

  const results: Record<string, unknown> = {};
  let lastSubtype = currentSubtype;

  for (const [requiredSubtype, transactions] of groups) {
    // Switch subtype if needed
    if (requiredSubtype !== null && requiredSubtype !== lastSubtype) {
      await client.call('maniphest.edit', {
        objectIdentifier,
        transactions: [{ type: 'subtype', value: requiredSubtype }],
      });
      lastSubtype = requiredSubtype;
    }

    const result = await client.call('maniphest.edit', {
      objectIdentifier,
      transactions,
    });
    results[requiredSubtype ?? 'default'] = result;
  }

  // Restore original subtype if we changed it
  if (lastSubtype !== currentSubtype && currentSubtype !== undefined) {
    await client.call('maniphest.edit', {
      objectIdentifier,
      transactions: [{ type: 'subtype', value: currentSubtype }],
    });
  }

  return results;
}

export function registerManiphestTools(server: McpServer, client: ConduitClient) {
  // Search tasks
  server.tool(
    'phabricator_task_search',
    'Search Maniphest tasks with optional filters',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "open", "authored", "assigned", "subscribed"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('Task IDs to search for'),
        phids: z.array(z.string()).optional().describe('Task PHIDs to search for'),
        assigned: z.array(z.string()).optional().describe('Assigned user PHIDs'),
        authorPHIDs: z.array(z.string()).optional().describe('Author PHIDs'),
        statuses: z.array(z.string()).optional().describe('Task statuses: open, resolved, wontfix, invalid, spite, duplicate'),
        priorities: z.array(z.coerce.number()).optional().describe('Priority levels'),
        subtypes: z.array(z.string()).optional().describe('Task subtypes'),
        columnPHIDs: z.array(z.string()).optional().describe('Workboard column PHIDs'),
        projects: z.array(z.string()).optional().describe('Project PHIDs (tasks tagged with these projects)'),
        query: z.string().optional().describe('Full-text search query'),
        createdStart: z.coerce.number().optional().describe('Created after (epoch timestamp)'),
        createdEnd: z.coerce.number().optional().describe('Created before (epoch timestamp)'),
        modifiedStart: z.coerce.number().optional().describe('Modified after (epoch timestamp)'),
        modifiedEnd: z.coerce.number().optional().describe('Modified before (epoch timestamp)'),
        parentIDs: z.array(z.coerce.number()).optional().describe('Parent task IDs'),
        subtaskIDs: z.array(z.coerce.number()).optional().describe('Subtask IDs'),
        hasParents: z.boolean().optional().describe('true: only tasks with open parent tasks. false: only tasks without. Omit to show all.'),
        hasSubtasks: z.boolean().optional().describe('true: only tasks with open subtasks. false: only tasks without. Omit to show all.'),
        subscribers: z.array(z.string()).optional().describe('Subscriber user/project PHIDs'),
        spaces: z.array(z.string()).optional().describe('Filter by Space PHIDs (for multi-space installations)'),
        closedStart: z.coerce.number().optional().describe('Closed after (epoch timestamp)'),
        closedEnd: z.coerce.number().optional().describe('Closed before (epoch timestamp)'),
        closerPHIDs: z.array(z.string()).optional().describe('PHIDs of users who closed the task'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
        columns: z.boolean().optional().describe('Include workboard column info'),
        projects: z.boolean().optional().describe('Include project info'),
        subscribers: z.boolean().optional().describe('Include subscriber info'),
      })).optional().describe('Data attachments to include'),
      order: z.string().optional().describe('Result order: "priority", "updated", "outdated", "newest", "oldest", "closed", "title", "relevance"'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
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
      priority: z.string().optional().describe('Priority keyword (unbreak, triage, high, normal, low, wish) or numeric value'),
      projectPHIDs: z.array(z.string()).optional().describe('Project PHIDs to tag'),
      subscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs'),
      status: z.string().optional().describe('Initial status'),
      subtype: z.string().optional().describe('Task subtype (e.g. "default", "incident")'),
      parentPHIDs: z.array(z.string()).optional().describe('Parent task PHIDs'),
      subtaskPHIDs: z.array(z.string()).optional().describe('Subtask PHIDs'),
      commitPHIDs: z.array(z.string()).optional().describe('Commit PHIDs to associate (for actual commits only, not revisions)'),
      revisionIDs: z.array(z.string()).optional().describe('Differential revision IDs to link (e.g. ["D223125"] or ["PHID-DREV-xxx"]). Creates a bidirectional link between the revision and the task.'),
      points: z.coerce.number().nullable().optional().describe('Story points value (if points are enabled on this instance)'),
      space: z.string().optional().describe('Space PHID to place the task in (for multi-space installations)'),
      comment: z.string().optional().describe('Initial comment on the task (supports Remarkup)'),
      customFields: jsonCoerce(z.record(z.string(), z.unknown())).optional().describe(
        'Custom field transactions. Keys are transaction types (e.g. "custom.my-field"), values are the field values. Check your Phabricator Conduit console (conduit/method/maniphest.edit/) for available fields.'
      ),
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
      if (params.subtype !== undefined) {
        transactions.push({ type: 'subtype', value: params.subtype });
      }
      if (params.parentPHIDs !== undefined) {
        transactions.push({ type: 'parents.set', value: params.parentPHIDs });
      }
      if (params.subtaskPHIDs !== undefined) {
        transactions.push({ type: 'subtasks.set', value: params.subtaskPHIDs });
      }
      if (params.commitPHIDs !== undefined) {
        transactions.push({ type: 'commits.set', value: params.commitPHIDs });
      }
      if (params.points !== undefined) {
        transactions.push({ type: 'points', value: params.points });
      }
      if (params.space !== undefined) {
        transactions.push({ type: 'space', value: params.space });
      }
      if (params.comment !== undefined) {
        transactions.push({ type: 'comment', value: params.comment });
      }
      const result = await client.call<{ object: { phid: string; id: number } }>('maniphest.edit', { transactions });

      const extras: Record<string, unknown> = {};

      // Custom fields are applied in a second call because Phabricator validates
      // transaction types against the default subtype during creation. Subtype-specific
      // custom fields (e.g. postmortem fields) require temporarily switching the subtype.
      if (params.customFields !== undefined && Object.keys(params.customFields).length > 0) {
        extras.customFields = await applyCustomFields(
          client,
          result.object.phid,
          params.customFields,
          params.subtype,
        );
      }

      // Link revisions to the newly created task via differential.revision.edit
      if (params.revisionIDs !== undefined && params.revisionIDs.length > 0) {
        const revPHIDs = await resolveRevisionPHIDs(client, params.revisionIDs);
        const taskId = `T${result.object.id}`;
        extras.linkedRevisions = await linkRevisionsToTask(client, taskId, revPHIDs, 'add');
      }

      const output = Object.keys(extras).length > 0 ? { ...result, ...extras } : result;
      return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }] };
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
      subtype: z.string().optional().describe('Task subtype (e.g. "default", "incident")'),
      addProjectPHIDs: z.array(z.string()).optional().describe('Project PHIDs to add'),
      removeProjectPHIDs: z.array(z.string()).optional().describe('Project PHIDs to remove'),
      addSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to add'),
      removeSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to remove'),
      addParentPHIDs: z.array(z.string()).optional().describe('Parent task PHIDs to add'),
      removeParentPHIDs: z.array(z.string()).optional().describe('Parent task PHIDs to remove'),
      addSubtaskPHIDs: z.array(z.string()).optional().describe('Subtask PHIDs to add'),
      removeSubtaskPHIDs: z.array(z.string()).optional().describe('Subtask PHIDs to remove'),
      addCommitPHIDs: z.array(z.string()).optional().describe('Commit PHIDs to associate (for actual commits only, not revisions)'),
      removeCommitPHIDs: z.array(z.string()).optional().describe('Commit PHIDs to disassociate (for actual commits only, not revisions)'),
      addRevisionIDs: z.array(z.string()).optional().describe('Differential revision IDs to link (e.g. ["D223125"] or ["PHID-DREV-xxx"]). Creates a bidirectional link between the revision and the task.'),
      removeRevisionIDs: z.array(z.string()).optional().describe('Differential revision IDs to unlink (e.g. ["D223125"] or ["PHID-DREV-xxx"]).'),
      points: z.coerce.number().nullable().optional().describe('Story points value (null to clear)'),
      columnPHID: z.string().optional().describe('Move to workboard column'),
      space: z.string().optional().describe('Space PHID to move the task to (for multi-space installations)'),
      comment: z.string().optional().describe('Add a comment alongside the edit (supports Remarkup)'),
      customFields: jsonCoerce(z.record(z.string(), z.unknown())).optional().describe(
        'Custom field transactions. Keys are transaction types (e.g. "custom.my-field"), values are the field values. Check your Phabricator Conduit console (conduit/method/maniphest.edit/) for available fields.'
      ),
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
      if (params.subtype !== undefined) {
        transactions.push({ type: 'subtype', value: params.subtype });
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
      if (params.addParentPHIDs !== undefined) {
        transactions.push({ type: 'parents.add', value: params.addParentPHIDs });
      }
      if (params.removeParentPHIDs !== undefined) {
        transactions.push({ type: 'parents.remove', value: params.removeParentPHIDs });
      }
      if (params.addSubtaskPHIDs !== undefined) {
        transactions.push({ type: 'subtasks.add', value: params.addSubtaskPHIDs });
      }
      if (params.removeSubtaskPHIDs !== undefined) {
        transactions.push({ type: 'subtasks.remove', value: params.removeSubtaskPHIDs });
      }
      if (params.addCommitPHIDs !== undefined) {
        transactions.push({ type: 'commits.add', value: params.addCommitPHIDs });
      }
      if (params.removeCommitPHIDs !== undefined) {
        transactions.push({ type: 'commits.remove', value: params.removeCommitPHIDs });
      }
      if (params.points !== undefined) {
        transactions.push({ type: 'points', value: params.points });
      }
      if (params.columnPHID !== undefined) {
        transactions.push({ type: 'column', value: [params.columnPHID] });
      }
      if (params.space !== undefined) {
        transactions.push({ type: 'space', value: params.space });
      }
      if (params.comment !== undefined) {
        transactions.push({ type: 'comment', value: params.comment });
      }
      const hasCustomFields = params.customFields !== undefined && Object.keys(params.customFields).length > 0;
      const hasRevisionChanges =
        (params.addRevisionIDs !== undefined && params.addRevisionIDs.length > 0) ||
        (params.removeRevisionIDs !== undefined && params.removeRevisionIDs.length > 0);

      if (transactions.length === 0 && !hasCustomFields && !hasRevisionChanges) {
        return { content: [{ type: 'text', text: 'No changes specified' }] };
      }

      const extras: Record<string, unknown> = {};

      let result: unknown = undefined;
      if (transactions.length > 0) {
        result = await client.call('maniphest.edit', {
          objectIdentifier: params.objectIdentifier,
          transactions,
        });
      }

      // Custom fields may require subtype switching (e.g. postmortem fields
      // need subtype "postmortem"). applyCustomFields handles this automatically.
      if (hasCustomFields) {
        extras.customFields = await applyCustomFields(
          client,
          params.objectIdentifier,
          params.customFields!,
          params.subtype,
        );
      }

      // Link/unlink revisions via differential.revision.edit
      if (params.addRevisionIDs !== undefined && params.addRevisionIDs.length > 0) {
        const revPHIDs = await resolveRevisionPHIDs(client, params.addRevisionIDs);
        extras.addedRevisions = await linkRevisionsToTask(client, params.objectIdentifier, revPHIDs, 'add');
      }
      if (params.removeRevisionIDs !== undefined && params.removeRevisionIDs.length > 0) {
        const revPHIDs = await resolveRevisionPHIDs(client, params.removeRevisionIDs);
        extras.removedRevisions = await linkRevisionsToTask(client, params.objectIdentifier, revPHIDs, 'remove');
      }

      const output = Object.keys(extras).length > 0
        ? { ...(result !== undefined ? { task: result } : {}), ...extras }
        : result;

      return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }] };
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

  // Search available task statuses
  server.tool(
    'phabricator_task_status_search',
    'List all available task statuses configured on this Phabricator instance',
    {},
    async () => {
      const result = await client.call('maniphest.status.search');
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Search available task priorities
  server.tool(
    'phabricator_task_priority_search',
    'List all available task priorities configured on this Phabricator instance',
    {},
    async () => {
      const result = await client.call('maniphest.priority.search');
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

}
