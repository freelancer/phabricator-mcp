import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP tool annotations, so clients can tell reads from writes, e.g. when to
 * ask for confirmation. Every tool passes one of these.
 *
 * openWorldHint is left unset (the spec default, true): results include text
 * written by other people, and some writes can publish outside Phabricator.
 */

/** Reads only. */
export const READ_ONLY: ToolAnnotations = { readOnlyHint: true };

/** Only adds (a task, a comment, a draft, a link); never overwrites or removes. */
export const ADDITIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false };

/** Can overwrite or remove existing data: a title, reviewers, a status. */
export const DESTRUCTIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true };
