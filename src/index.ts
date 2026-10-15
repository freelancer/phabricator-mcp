#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadConfig } from './config.js';
import { ConduitClient } from './client/conduit.js';
import { registerAllTools } from './tools/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

async function main() {
  const config = loadConfig();
  const client = new ConduitClient(config);

  const server = new McpServer(
    {
      name: 'phabricator',
      version: pkg.version,
    },
    {
      instructions: 'Results omit null and empty fields; a missing field has no value. Paged results: pass cursor.after as "after" until it is null.',
    },
  );

  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
