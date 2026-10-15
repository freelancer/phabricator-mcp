import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';
import { jsonCoerce } from './coerce.js';
import { jsonResult } from './result.js';
import { ADDITIVE, DESTRUCTIVE, READ_ONLY } from './annotations.js';

export function registerPhameTools(server: McpServer, client: ConduitClient) {
  // Search blogs
  server.tool(
    'phabricator_blog_search',
    'Search Phame blogs',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active", "archived"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('Blog IDs'),
        phids: z.array(z.string()).optional().describe('Blog PHIDs'),
        subscribers: z.array(z.string()).optional().describe('Subscriber user/project PHIDs'),
        projects: z.array(z.string()).optional().describe('Project PHIDs'),
        query: z.string().optional().describe('Full-text search query'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
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
      const result = await client.call('phame.blog.search', params);
      return jsonResult(result);
    },
  );

  // Edit a blog
  server.tool(
    'phabricator_blog_edit',
    'Create or edit a Phame blog. Omit objectIdentifier to create a new blog (name is required for creation).',
    {
      objectIdentifier: z.string().optional().describe('Blog PHID or ID. Omit to create a new blog.'),
      name: z.string().optional().describe('Blog name'),
      subtitle: z.string().optional().describe('Blog subtitle'),
      description: z.string().optional().describe('Blog description (Remarkup)'),
      domainFullURI: z.string().optional().describe('Custom full domain URI for the blog'),
      parentSite: z.string().optional().describe('Parent site name'),
      parentDomain: z.string().optional().describe('Parent domain URL'),
      status: z.string().optional().describe('Blog status'),
      addSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to add'),
      removeSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to remove'),
    },
    DESTRUCTIVE,
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [];

      if (params.name !== undefined) {
        transactions.push({ type: 'name', value: params.name });
      }
      if (params.subtitle !== undefined) {
        transactions.push({ type: 'subtitle', value: params.subtitle });
      }
      if (params.description !== undefined) {
        transactions.push({ type: 'description', value: params.description });
      }
      if (params.domainFullURI !== undefined) {
        transactions.push({ type: 'domainFullURI', value: params.domainFullURI });
      }
      if (params.parentSite !== undefined) {
        transactions.push({ type: 'parentSite', value: params.parentSite });
      }
      if (params.parentDomain !== undefined) {
        transactions.push({ type: 'parentDomain', value: params.parentDomain });
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

      if (transactions.length === 0) {
        return { content: [{ type: 'text', text: 'No changes specified' }] };
      }

      const apiParams: Record<string, unknown> = { transactions };
      if (params.objectIdentifier !== undefined) {
        apiParams.objectIdentifier = params.objectIdentifier;
      }
      const result = await client.call('phame.blog.edit', apiParams);
      return jsonResult(result);
    },
  );

  // Search blog posts
  server.tool(
    'phabricator_blog_post_search',
    'Search Phame blog posts',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "live", "draft", "archived"'),
      constraints: jsonCoerce(z.object({
        ids: z.array(z.coerce.number()).optional().describe('Post IDs'),
        phids: z.array(z.string()).optional().describe('Post PHIDs'),
        blogPHIDs: z.array(z.string()).optional().describe('Filter by blog PHIDs'),
        visibility: z.array(z.string()).optional().describe('Visibility values: "0" (draft), "1" (published), "2" (archived)'),
        subscribers: z.array(z.string()).optional().describe('Subscriber user/project PHIDs'),
        projects: z.array(z.string()).optional().describe('Project PHIDs'),
        query: z.string().optional().describe('Full-text search query'),
      })).optional().describe('Search constraints'),
      attachments: jsonCoerce(z.object({
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
      const result = await client.call('phame.post.search', params);
      return jsonResult(result);
    },
  );

  // Create blog post
  server.tool(
    'phabricator_blog_post_create',
    'Create a new Phame blog post',
    {
      title: z.string().describe('Post title'),
      body: z.string().describe('Post body content (supports Remarkup)'),
      blogPHID: z.string().describe('PHID of the blog to post to'),
      subtitle: z.string().optional().describe('Post subtitle'),
      visibility: z.coerce.number().optional().describe('Visibility: 0 (draft, default), 1 (published), 2 (archived)'),
      addSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to add'),
    },
    ADDITIVE,
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [
        { type: 'title', value: params.title },
        { type: 'body', value: params.body },
        { type: 'blog', value: params.blogPHID },
      ];

      if (params.subtitle !== undefined) {
        transactions.push({ type: 'subtitle', value: params.subtitle });
      }
      // Phabricator expects visibility as a string; default to draft ("0") when not provided
      transactions.push({ type: 'visibility', value: String(params.visibility ?? 0) });
      if (params.addSubscriberPHIDs !== undefined) {
        transactions.push({ type: 'subscribers.add', value: params.addSubscriberPHIDs });
      }

      const result = await client.call('phame.post.edit', { transactions });
      return jsonResult(result);
    },
  );

  // Edit blog post
  server.tool(
    'phabricator_blog_post_edit',
    'Edit an existing Phame blog post',
    {
      objectIdentifier: z.string().describe('Post PHID or ID'),
      title: z.string().optional().describe('New post title'),
      subtitle: z.string().optional().describe('New post subtitle'),
      body: z.string().optional().describe('New post body content (supports Remarkup)'),
      visibility: z.coerce.number().optional().describe('Visibility: 0 (draft), 1 (published), 2 (archived)'),
      blogPHID: z.string().optional().describe('Move post to a different blog (PHID)'),
      addSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to add'),
      removeSubscriberPHIDs: z.array(z.string()).optional().describe('Subscriber PHIDs to remove'),
      comment: z.string().optional().describe('Add a comment alongside the edit (supports Remarkup)'),
    },
    DESTRUCTIVE,
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [];

      if (params.title !== undefined) {
        transactions.push({ type: 'title', value: params.title });
      }
      if (params.subtitle !== undefined) {
        transactions.push({ type: 'subtitle', value: params.subtitle });
      }
      if (params.body !== undefined) {
        transactions.push({ type: 'body', value: params.body });
      }
      if (params.visibility !== undefined) {
        transactions.push({ type: 'visibility', value: String(params.visibility) });
      }
      if (params.blogPHID !== undefined) {
        transactions.push({ type: 'blog', value: params.blogPHID });
      }
      if (params.addSubscriberPHIDs !== undefined) {
        transactions.push({ type: 'subscribers.add', value: params.addSubscriberPHIDs });
      }
      if (params.removeSubscriberPHIDs !== undefined) {
        transactions.push({ type: 'subscribers.remove', value: params.removeSubscriberPHIDs });
      }
      if (params.comment !== undefined) {
        transactions.push({ type: 'comment', value: params.comment });
      }

      if (transactions.length === 0) {
        return { content: [{ type: 'text', text: 'No changes specified' }] };
      }

      const result = await client.call('phame.post.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions,
      });
      return jsonResult(result);
    },
  );

  // Add comment to blog post
  server.tool(
    'phabricator_blog_post_add_comment',
    'Add a comment to a Phame blog post',
    {
      objectIdentifier: z.string().describe('Post PHID or ID'),
      comment: z.string().describe('Comment text (supports Remarkup)'),
    },
    ADDITIVE,
    async (params) => {
      const result = await client.call('phame.post.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions: [{ type: 'comment', value: params.comment }],
      });
      return jsonResult(result);
    },
  );
}
