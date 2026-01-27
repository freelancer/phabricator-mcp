#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { ConduitClient } from './client/conduit.js';
import { registerAllTools } from './tools/index.js';

async function main() {
  const config = loadConfig();
  const client = new ConduitClient(config);

  const server = new McpServer({
    name: 'phabricator',
    version: '1.0.0',
  });

  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
