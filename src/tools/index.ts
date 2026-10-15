import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { registerManiphestTools } from './maniphest.js';
import { registerDifferentialTools } from './differential.js';
import { registerDiffusionTools } from './diffusion.js';
import { registerUserTools } from './user.js';
import { registerProjectTools } from './project.js';
import { registerPasteTools } from './paste.js';
import { registerPhrictionTools } from './phriction.js';
import { registerPhidTools } from './phid.js';
import { registerPhameTools } from './phame.js';
import { registerTransactionTools } from './transaction.js';
import { registerFileTools } from './file.js';
import { registerHarbormasterTools } from './harbormaster.js';
import { registerOwnersTools } from './owners.js';
import { registerFeedTools } from './feed.js';
import { registerConpherenceTools } from './conpherence.js';
import { registerAuditTools } from './audit.js';
import { READ_ONLY } from './annotations.js';
import { recordTools } from './availability.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

/**
 * Registers every tool and returns them by name, so the ones the instance
 * cannot serve can be hidden (see hideUnavailableTools).
 */
export function registerAllTools(server: McpServer, client: ConduitClient): Map<string, RegisteredTool> {
  const registered = new Map<string, RegisteredTool>();
  const tools = recordTools(server, registered);

  tools.tool(
    'phabricator_version',
    'Get the version of the running phabricator-mcp server',
    {},
    READ_ONLY,
    async () => ({
      content: [{ type: 'text', text: pkg.version }],
    }),
  );

  registerManiphestTools(tools, client);
  registerDifferentialTools(tools, client);
  registerDiffusionTools(tools, client);
  registerUserTools(tools, client);
  registerProjectTools(tools, client);
  registerPasteTools(tools, client);
  registerPhrictionTools(tools, client);
  registerPhidTools(tools, client);
  registerPhameTools(tools, client);
  registerTransactionTools(tools, client);
  registerFileTools(tools, client);
  registerHarbormasterTools(tools, client);
  registerOwnersTools(tools, client);
  registerFeedTools(tools, client);
  registerConpherenceTools(tools, client);
  registerAuditTools(tools, client);
  return registered;
}
