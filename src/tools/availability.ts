import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ConduitClient } from '../client/conduit.js';
import type { Config } from '../config.js';

/**
 * The Conduit method that provides each tool, or its alternatives: a tool is
 * registered if the instance offers any of them. Secondary calls a tool makes
 * (user.whoami, phid.lookup, file.info and the like) are left out because every
 * instance has them. A Phabricator can lack a method because its application is not
 * installed (Conpherence), because its version or fork does not have it
 * (phriction.document.edit is in Phorge only), or because it comes from an
 * extension (differential.inline.*). Tools whose methods are missing are
 * hidden, so an agent never picks a tool that can only fail.
 */
export const TOOL_METHODS: Record<string, string[]> = {
  phabricator_version: [],

  phabricator_task_search: ['maniphest.search'],
  phabricator_task_create: ['maniphest.edit'],
  phabricator_task_edit: ['maniphest.edit'],
  phabricator_task_add_comment: ['maniphest.edit'],
  phabricator_task_status_search: ['maniphest.status.search'],
  phabricator_task_priority_search: ['maniphest.priority.search'],

  phabricator_revision_search: ['differential.revision.search'],
  phabricator_revision_edit: ['differential.revision.edit'],
  phabricator_diff_raw: ['differential.getrawdiff'],
  phabricator_diff_search: ['differential.diff.search'],
  phabricator_revision_paths: ['differential.getcommitpaths'],
  phabricator_revision_inline_comment: ['differential.inline.create', 'differential.createinline'],
  phabricator_revision_inline_search: ['differential.inline.search'],
  phabricator_revision_inline_publish: ['differential.inline.publish'],
  phabricator_revision_inline_done: ['differential.inline.setdone'],

  phabricator_repository_search: ['diffusion.repository.search'],
  phabricator_commit_search: ['diffusion.commit.search'],
  phabricator_repository_browse: ['diffusion.browsequery'],
  phabricator_repository_file_content: ['diffusion.filecontentquery'],
  phabricator_branch_search: ['diffusion.branchquery'],
  phabricator_tag_search: ['diffusion.tagsquery'],
  phabricator_repository_file_history: ['diffusion.historyquery'],
  phabricator_repository_code_search: ['diffusion.searchquery'],
  phabricator_repository_edit: ['diffusion.repository.edit'],

  phabricator_user_whoami: ['user.whoami'],
  phabricator_user_search: ['user.search'],

  phabricator_project_search: ['project.search'],
  phabricator_project_edit: ['project.edit'],
  phabricator_column_search: ['project.column.search'],

  phabricator_paste_search: ['paste.search'],
  phabricator_paste_create: ['paste.edit'],
  phabricator_paste_edit: ['paste.edit'],

  phabricator_document_search: ['phriction.document.search'],
  phabricator_document_create: ['phriction.create'],
  phabricator_document_edit: ['phriction.edit'],
  phabricator_document_add_comment: ['phriction.document.edit'],

  phabricator_phid_lookup: ['phid.lookup'],
  phabricator_phid_query: ['phid.query'],

  phabricator_blog_search: ['phame.blog.search'],
  phabricator_blog_edit: ['phame.blog.edit'],
  phabricator_blog_post_search: ['phame.post.search'],
  phabricator_blog_post_create: ['phame.post.edit'],
  phabricator_blog_post_edit: ['phame.post.edit'],
  phabricator_blog_post_add_comment: ['phame.post.edit'],

  phabricator_transaction_search: ['transaction.search'],

  phabricator_file_upload: ['file.upload'],
  phabricator_file_search: ['file.search'],
  phabricator_file_info: ['file.info'],

  phabricator_buildable_search: ['harbormaster.buildable.search'],
  phabricator_build_search: ['harbormaster.build.search'],
  phabricator_build_target_search: ['harbormaster.target.search'],
  phabricator_build_log_search: ['harbormaster.log.search'],
  phabricator_build_command: ['harbormaster.sendmessage'],
  phabricator_build_plan_search: ['harbormaster.buildplan.search'],

  phabricator_owners_search: ['owners.search'],
  phabricator_feed_query: ['feed.query'],

  phabricator_conpherence_read: ['conpherence.querytransaction'],
  phabricator_conpherence_create: ['conpherence.edit'],
  phabricator_conpherence_edit: ['conpherence.edit'],
  phabricator_conpherence_send: ['conpherence.edit'],

  phabricator_audit_query: ['audit.query'],
};

export function isToolAvailable(name: string, methods: ReadonlySet<string>): boolean {
  const needs = TOOL_METHODS[name] ?? [];
  return needs.length === 0 || needs.some((method) => methods.has(method));
}

/**
 * The Conduit methods the instance offers, from conduit.query, or null when
 * they cannot be listed within `timeoutMs`. The request is aborted on timeout,
 * since the list is about 70 KB.
 */
export async function loadConduitMethods(
  client: ConduitClient,
  timeoutMs = 5000,
): Promise<Set<string> | null> {
  try {
    const result = await client.call<Record<string, unknown>>('conduit.query', {}, { signal: AbortSignal.timeout(timeoutMs) });
    // conduit.query lists itself; anything else is not a method list.
    const methods = new Set(Object.keys(result ?? {}));
    if (!methods.has('conduit.query')) {
      throw new Error('conduit.query returned no method list');
    }
    return methods;
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError'
      ? `no answer in ${timeoutMs}ms`
      : error instanceof Error ? error.message : String(error);
    console.error(`phabricator-mcp: cannot list Conduit methods: ${reason}`);
    return null;
  }
}

/**
 * Where the method list is cached. conduit.query only lists methods of
 * applications the caller can see, so the cache is per URL and token; the
 * token is hashed so it is not written to disk.
 */
export function methodCachePath(config: Config): string {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  const id = createHash('sha256').update(`${config.phabricatorUrl}\0${config.apiToken}`).digest('hex').slice(0, 16);
  return join(base, 'phabricator-mcp', `conduit-methods-${id}.json`);
}

export function readMethodCache(path: string): Set<string> | null {
  try {
    const { methods } = JSON.parse(readFileSync(path, 'utf-8')) as { methods: unknown };
    return Array.isArray(methods) && methods.includes('conduit.query') ? new Set(methods as string[]) : null;
  } catch {
    return null;
  }
}

export function writeMethodCache(path: string, methods: ReadonlySet<string>): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    // Write then rename, so a server starting meanwhile never reads half a file.
    const temporary = `${path}.${process.pid}`;
    writeFileSync(temporary, JSON.stringify({ methods: [...methods].sort() }));
    renameSync(temporary, path);
  } catch (error) {
    console.error(`phabricator-mcp: cannot cache Conduit methods in ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * A view of `server` whose `tool()` and `registerTool()` record each tool in
 * `tools` by name, so it can be hidden or shown later. Both take the tool's
 * name first. A tool missing from TOOL_METHODS fails here, at startup, rather
 * than being offered on instances that cannot serve it.
 */
export function recordTools(server: McpServer, tools: Map<string, RegisteredTool>): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== 'tool' && prop !== 'registerTool') {
        return value;
      }
      return (name: string, ...rest: unknown[]) => {
        if (!(name in TOOL_METHODS)) {
          throw new Error(`${name} has no entry in TOOL_METHODS (src/tools/availability.ts)`);
        }
        const tool = (value as (...args: unknown[]) => RegisteredTool).call(target, name, ...rest);
        tools.set(name, tool);
        return tool;
      };
    },
  });
}

/**
 * Show the tools `methods` can serve and hide the rest. Once the server is
 * connected, each change notifies the client (tools/list_changed).
 */
export function applyConduitMethods(tools: ReadonlyMap<string, RegisteredTool>, methods: ReadonlySet<string>): void {
  for (const [name, tool] of tools) {
    const available = isToolAvailable(name, methods);
    if (tool.enabled !== available) {
      if (available) {
        tool.enable();
      } else {
        tool.disable();
      }
    }
  }
}

/**
 * Hide the tools whose Conduit methods the instance does not offer.
 *
 * With a cached method list this applies it and returns at once, then
 * refreshes the list from conduit.query in the background: an instance gains
 * or loses methods only on an upgrade or when an application is installed or
 * removed, and such a change reaches the client as tools/list_changed and the
 * cache. Without one (the first run for this URL and token) it waits up to
 * `timeoutMs` for conduit.query; if that fails every tool stays listed.
 * `refreshed` settles when the background refresh is done.
 */
export async function hideUnavailableTools(
  tools: ReadonlyMap<string, RegisteredTool>,
  client: ConduitClient,
  cachePath: string,
  { timeoutMs = 5000, refreshTimeoutMs = 30_000 } = {},
): Promise<{ refreshed: Promise<void> }> {
  const cached = readMethodCache(cachePath);
  if (cached === null) {
    const methods = await loadConduitMethods(client, timeoutMs);
    if (methods !== null) {
      applyConduitMethods(tools, methods);
      writeMethodCache(cachePath, methods);
    }
    return { refreshed: Promise.resolve() };
  }

  applyConduitMethods(tools, cached);
  const refreshed = loadConduitMethods(client, refreshTimeoutMs).then((methods) => {
    if (methods === null) {
      return;
    }
    applyConduitMethods(tools, methods);
    if (methods.size !== cached.size || [...methods].some((method) => !cached.has(method))) {
      writeMethodCache(cachePath, methods);
    }
  });
  return { refreshed };
}
