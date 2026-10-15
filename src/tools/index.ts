import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));

export function registerAllTools(server: McpServer, client: ConduitClient) {
  server.tool(
    'phabricator_version',
    'Get the version of the running phabricator-mcp server',
    {},
    READ_ONLY,
    async () => ({
      content: [{ type: 'text', text: pkg.version }],
    }),
  );

  registerManiphestTools(server, client);
  registerDifferentialTools(server, client);
  registerDiffusionTools(server, client);
  registerUserTools(server, client);
  registerProjectTools(server, client);
  registerPasteTools(server, client);
  registerPhrictionTools(server, client);
  registerPhidTools(server, client);
  registerPhameTools(server, client);
  registerTransactionTools(server, client);
  registerFileTools(server, client);
  registerHarbormasterTools(server, client);
  registerOwnersTools(server, client);
  registerFeedTools(server, client);
  registerConpherenceTools(server, client);
  registerAuditTools(server, client);
}
