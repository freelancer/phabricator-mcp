import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConduitClient } from '../client/conduit.js';
import { registerManiphestTools } from './maniphest.js';
import { registerDifferentialTools } from './differential.js';
import { registerDiffusionTools } from './diffusion.js';
import { registerUserTools } from './user.js';
import { registerProjectTools } from './project.js';
import { registerPasteTools } from './paste.js';
import { registerPhrictionTools } from './phriction.js';
import { registerPhidTools } from './phid.js';

export function registerAllTools(server: McpServer, client: ConduitClient) {
  registerManiphestTools(server, client);
  registerDifferentialTools(server, client);
  registerDiffusionTools(server, client);
  registerUserTools(server, client);
  registerProjectTools(server, client);
  registerPasteTools(server, client);
  registerPhrictionTools(server, client);
  registerPhidTools(server, client);
}
