import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { z } from 'zod';

export function registerPhameTools(server: McpServer, client: ConduitClient) {
  // Search blogs
  server.tool(
    'phabricator_blog_search',
    'Search Phame blogs',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "active"'),
      constraints: z.object({
        ids: z.array(z.number()).optional().describe('Blog IDs'),
        phids: z.array(z.string()).optional().describe('Blog PHIDs'),
        query: z.string().optional().describe('Full-text search query'),
      }).optional().describe('Search constraints'),
      order: z.string().optional().describe('Result order'),
      limit: z.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for pagination'),
    },
    async (params) => {
      const result = await client.call('phame.blog.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  // Search blog posts
  server.tool(
    'phabricator_blog_post_search',
    'Search Phame blog posts',
    {
      queryKey: z.string().optional().describe('Built-in query: "all", "live"'),
      constraints: z.object({
        ids: z.array(z.number()).optional().describe('Post IDs'),
        phids: z.array(z.string()).optional().describe('Post PHIDs'),
        blogPHIDs: z.array(z.string()).optional().describe('Filter by blog PHIDs'),
        visibility: z.array(z.string()).optional().describe('Visibility: "published", "draft", "archived"'),
        query: z.string().optional().describe('Full-text search query'),
      }).optional().describe('Search constraints'),
      order: z.string().optional().describe('Result order'),
      limit: z.number().max(100).optional().describe('Maximum results (max 100)'),
      after: z.string().optional().describe('Cursor for pagination'),
    },
    async (params) => {
      const result = await client.call('phame.post.search', params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
      visibility: z.string().optional().describe('Visibility: "published", "draft", "archived" (default: draft)'),
    },
    async (params) => {
      const transactions: Array<{ type: string; value: unknown }> = [
        { type: 'title', value: params.title },
        { type: 'body', value: params.body },
        { type: 'blog', value: params.blogPHID },
      ];

      if (params.subtitle !== undefined) {
        transactions.push({ type: 'subtitle', value: params.subtitle });
      }
      if (params.visibility !== undefined) {
        transactions.push({ type: 'visibility', value: params.visibility });
      }

      const result = await client.call('phame.post.edit', { transactions });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
      visibility: z.string().optional().describe('Visibility: "published", "draft", "archived"'),
      blogPHID: z.string().optional().describe('Move post to a different blog (PHID)'),
    },
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
        transactions.push({ type: 'visibility', value: params.visibility });
      }
      if (params.blogPHID !== undefined) {
        transactions.push({ type: 'blog', value: params.blogPHID });
      }

      if (transactions.length === 0) {
        return { content: [{ type: 'text', text: 'No changes specified' }] };
      }

      const result = await client.call('phame.post.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
    async (params) => {
      const result = await client.call('phame.post.edit', {
        objectIdentifier: params.objectIdentifier,
        transactions: [{ type: 'comment', value: params.comment }],
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
