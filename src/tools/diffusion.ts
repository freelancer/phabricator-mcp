import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonCoerce } from './coerce.js';
import { jsonResult } from './result.js';

export function registerDiffusionTools(server: McpServer, client: ConduitClient) {
  // Search repositories
  server.tool(
    'phabricator_repository_search',
    'Search Diffusion repositories',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('Repository IDs'),
        phids: z.array(z.string()).optional().describe('Repository PHIDs'),
        callsigns: z.array(z.string()).optional().describe('Repository callsigns'),
        shortNames: z.array(z.string()).optional().describe('Repository short names'),
        types: z.array(z.string()).optional().describe('VCS types: git, hg, svn'),
        uris: z.array(z.string()).optional().describe('Repository URIs'),
        projects: z.array(z.string()).optional().describe('Project PHIDs'),
        spaces: z.array(z.string()).optional().describe('Space PHIDs (for multi-space installations)'),
        query: z.string().optional().describe('Full-text search query'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
        uris: z.boolean().optional().describe('Include repository URIs'),
        metrics: z.boolean().optional().describe('Include metrics'),
        projects: z.boolean().optional().describe('Include projects'),
      })).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    async (params) => {
      const result = await client.call('diffusion.repository.search', params);
      return jsonResult(result);
    },
  );

  // Search commits
  server.tool(
    'phabricator_commit_search',
    'Search Diffusion commits',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active", "authored", "audited"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('Commit IDs'),
        phids: z.array(z.string()).optional().describe('Commit PHIDs'),
        repositories: z.array(z.string()).optional().describe('Repository PHIDs'),
        identifiers: z.array(z.string()).optional().describe('Commit identifiers (hashes)'),
        authors: z.array(z.string()).optional().describe('Author PHIDs'),
        auditors: z.array(z.string()).optional().describe('Auditor user/project PHIDs'),
        responsible: z.array(z.string()).optional().describe('User PHIDs responsible (as author or auditor)'),
        statuses: z.array(z.string()).optional().describe('Audit statuses: none, needs-audit, concern-raised, partially-audited, audited, needs-verification'),
        packages: z.array(z.string()).optional().describe('Owners package PHIDs'),
        unreachable: z.boolean().optional().describe('Include unreachable commits'),
        permanent: z.boolean().optional().describe('Filter by permanent (reachable from any permanent ref) status'),
        ancestorsOf: z.array(z.string()).optional().describe('Find ancestors of these commit identifiers'),
        subscribers: z.array(z.string()).optional().describe('Subscriber user/project PHIDs'),
        projects: z.array(z.string()).optional().describe('Project PHIDs'),
        query: z.string().optional().describe('Full-text search query'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
        projects: z.boolean().optional().describe('Include projects'),
        subscribers: z.boolean().optional().describe('Include subscribers'),
      })).optional().describe('Data attachments'),
      order: z.string().optional().describe('Result order'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for next-page pagination'),
      before: z.string().optional().describe('Cursor for previous-page pagination'),
    },
    async (params) => {
      const result = await client.call('diffusion.commit.search', params);
      return jsonResult(result);
    },
  );

  // Browse repository file tree
  server.tool(
    'phabricator_repository_browse',
    'Browse a repository directory tree at a given path and commit/branch. Pass a branch name via the commit parameter.',
    {
      path: z.string().optional().describe('Path to browse (default: "/")'),
      repository: z.string().optional().describe('Repository callsign, short name, or PHID'),
      commit: z.string().optional().describe('Commit hash or branch name (default: HEAD). Pass branch names here.'),
      needValidityOnly: z.boolean().optional().describe('Only check path validity without loading the full tree'),
      limit: z.coerce.number().optional().describe('Maximum entries to return'),
      offset: z.coerce.number().optional().describe('Result offset for pagination'),
    },
    async (params) => {
      const result = await client.call('diffusion.browsequery', params);
      return jsonResult(result);
    },
  );

  // Read file content from repository
  server.tool(
    'phabricator_repository_file_content',
    'Read file contents from a Diffusion repository at a given path and commit/branch. Returns the file content as a base64-encoded blob. If the file is too large, returns tooHuge: true with no content.',
    {
      path: z.string().describe('File path in the repository (e.g., "src/index.ts")'),
      repository: z.string().optional().describe('Repository callsign, short name, or PHID'),
      commit: z.string().describe('Commit hash or branch name'),
      branch: z.string().optional().describe('Branch name'),
      timeout: z.coerce.number().optional().describe('Query timeout in seconds'),
      byteLimit: z.coerce.number().optional().describe('Maximum file size in bytes to return'),
    },
    async (params) => {
      const result = await client.call<{ filePHID: string; tooHuge: boolean; tooSlow: boolean }>('diffusion.filecontentquery', {
        path: params.path,
        repository: params.repository,
        commit: params.commit,
        branch: params.branch,
        timeout: params.timeout,
        byteLimit: params.byteLimit,
      });
      if (result.tooHuge || result.tooSlow) {
        return jsonResult(result);
      }
      // Fetch actual file content using the returned filePHID
      const fileInfo = await client.call<{ name: string; dataURI: string; byteSize: string; mimeType: string }>('file.info', {
        phid: result.filePHID,
      });
      return jsonResult({ ...result, ...fileInfo });
    },
  );

  // List branches
  server.tool(
    'phabricator_branch_search',
    'List branches in a Diffusion repository',
    {
      repository: z.string().describe('Repository callsign, short name, or PHID'),
      branch: z.string().optional().describe('Branch name'),
      contains: z.string().optional().describe('Only branches containing this commit'),
      patterns: z.array(z.string()).optional().describe('Filter branches by glob patterns'),
      closed: z.boolean().optional().describe('Filter by open/closed status (Mercurial only)'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      offset: z.coerce.number().optional().describe('Result offset for pagination'),
    },
    async (params) => {
      const result = await client.call('diffusion.branchquery', params);
      return jsonResult(result);
    },
  );

  // List tags
  server.tool(
    'phabricator_tag_search',
    'List tags in a Diffusion repository',
    {
      repository: z.string().describe('Repository callsign, short name, or PHID'),
      branch: z.string().optional().describe('Branch name'),
      names: z.array(z.string()).optional().describe('Filter to specific tag names'),
      commit: z.string().optional().describe('Show tags reachable from this commit'),
      needMessages: z.boolean().optional().describe('Include tag messages in results'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      offset: z.coerce.number().optional().describe('Result offset for pagination'),
    },
    async (params) => {
      const result = await client.call('diffusion.tagsquery', params);
      return jsonResult(result);
    },
  );

  // File commit history
  server.tool(
    'phabricator_repository_file_history',
    'Get commit history for a file or directory path in a Diffusion repository',
    {
      path: z.string().describe('File or directory path in the repository'),
      repository: z.string().optional().describe('Repository callsign, short name, or PHID'),
      commit: z.string().describe('Commit hash or branch to start from'),
      branch: z.string().optional().describe('Branch name'),
      against: z.string().optional().describe('Compare against another commit'),
      needDirectChanges: z.boolean().optional().describe('Include direct change info per path entry'),
      needChildChanges: z.boolean().optional().describe('Include child change info per path entry'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (default: 100)'),
      offset: z.coerce.number().optional().describe('Result offset for pagination (default: 0)'),
    },
    async (params) => {
      const result = await client.call('diffusion.historyquery', {
        ...params,
        offset: params.offset ?? 0,
        limit: params.limit ?? 100,
      });
      return jsonResult(result);
    },
  );

  // Search file contents in repository
  server.tool(
    'phabricator_repository_code_search',
    'Search (grep) file contents within a Diffusion repository',
    {
      path: z.string().optional().describe('Directory path to search within (default: root)'),
      repository: z.string().describe('Repository callsign, short name, or PHID'),
      query: z.string().describe('Search query / pattern'),
      commit: z.string().optional().describe('Commit hash or branch (default: HEAD)'),
      branch: z.string().optional().describe('Branch name'),
      limit: z.coerce.number().max(100).optional().describe('Maximum results (max 100)'),
      offset: z.coerce.number().optional().describe('Result offset for pagination'),
    },
    async (params) => {
      const result = await client.call('diffusion.searchquery', {
        path: params.path ?? '',
        repository: params.repository,
        grep: params.query,
        commit: params.commit,
        branch: params.branch,
        limit: params.limit,
        offset: params.offset,
      });
      return jsonResult(result);
    },
  );

  // Create or edit a repository
  server.tool(
    'phabricator_repository_edit',
    'Create or edit a Diffusion repository. To create, omit objectIdentifier and provide vcs + name.',
    {
      objectIdentifier: z.string().optional().describe('Repository PHID, ID, callsign, or short name (omit to create new)'),
      vcs: z.enum(['git', 'hg', 'svn']).optional().describe('Version control system (required for creation)'),
      name: z.string().optional().describe('Repository name'),
      callsign: z.string().optional().describe('Repository callsign (short uppercase identifier)'),
      shortName: z.string().optional().describe('Repository short name (URL slug)'),
      description: z.string().optional().describe('Repository description (Remarkup)'),
      defaultBranch: z.string().optional().describe('Default branch name'),
      status: z.enum(['active', 'inactive']).optional().describe('Repository status'),
      addProjectPHIDs: z.array(z.string()).optional().describe('Project PHIDs to add'),
      removeProjectPHIDs: z.array(z.string()).optional().describe('Project PHIDs to remove'),
      space: z.string().optional().describe('Space PHID (for multi-space installations)'),
    },
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [];

      if (params.vcs !== undefined) {
        transactions.push({ type: 'vcs', value: params.vcs });
      }
      if (params.name !== undefined) {
        transactions.push({ type: 'name', value: params.name });
      }
      if (params.callsign !== undefined) {
        transactions.push({ type: 'callsign', value: params.callsign });
      }
      if (params.shortName !== undefined) {
        transactions.push({ type: 'shortName', value: params.shortName });
      }
      if (params.description !== undefined) {
        transactions.push({ type: 'description', value: params.description });
      }
      if (params.defaultBranch !== undefined) {
        transactions.push({ type: 'defaultBranch', value: params.defaultBranch });
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
      if (params.space !== undefined) {
        transactions.push({ type: 'space', value: params.space });
      }

      if (transactions.length === 0) {
        return { content: [{ type: 'text', text: 'No changes specified' }] };
      }

      const apiParams: Record<string, unknown> = { transactions };
      if (params.objectIdentifier !== undefined) {
        apiParams.objectIdentifier = params.objectIdentifier;
      }

      const result = await client.call('diffusion.repository.edit', apiParams);
      return jsonResult(result);
    },
  );
}
