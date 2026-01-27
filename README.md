# phabricator-mcp

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that wraps Phabricator's Conduit API, enabling any MCP client to interact with Phabricator tasks, code reviews, repositories, and more.

## Installation

```bash
claude mcp add phabricator -- npx github:freelancer/phabricator-mcp
```

Or with environment variables (if not using `~/.arcrc`):

```bash
claude mcp add phabricator \
  -e PHABRICATOR_URL=https://phabricator.example.com \
  -e PHABRICATOR_API_TOKEN=api-xxxxx \
  -- npx github:freelancer/phabricator-mcp
```

## Configuration

The server automatically reads configuration from `~/.arcrc` (created by [Arcanist](https://secure.phabricator.com/book/phabricator/article/arcanist/)). No additional configuration is needed if you've already set up `arc`.

Alternatively, set environment variables (which take precedence over `.arcrc`):

- `PHABRICATOR_URL` - Phabricator instance URL
- `PHABRICATOR_API_TOKEN` - Conduit API token

You can get an API token from your Phabricator instance at: **Settings > Conduit API Tokens**

### Generic MCP client configuration

```json
{
  "mcpServers": {
    "phabricator": {
      "command": "npx",
      "args": ["github:freelancer/phabricator-mcp"],
      "env": {
        "PHABRICATOR_URL": "https://phabricator.example.com",
        "PHABRICATOR_API_TOKEN": "api-xxxxxxxxxxxxx"
      }
    }
  }
}
```

## Available Tools

### Task Management (Maniphest)

| Tool | Description |
|------|-------------|
| `phabricator_task_search` | Search tasks with filters (status, assignee, project, etc.) |
| `phabricator_task_create` | Create a new task |
| `phabricator_task_edit` | Edit an existing task |
| `phabricator_task_add_comment` | Add a comment to a task |

### Code Reviews (Differential)

| Tool | Description |
|------|-------------|
| `phabricator_revision_search` | Search code review revisions |
| `phabricator_revision_edit` | Edit a revision (add reviewers, comment, etc.) |
| `phabricator_diff_search` | Search diffs |

### Repositories (Diffusion)

| Tool | Description |
|------|-------------|
| `phabricator_repository_search` | Search repositories |
| `phabricator_commit_search` | Search commits |

### Users

| Tool | Description |
|------|-------------|
| `phabricator_user_whoami` | Get current authenticated user |
| `phabricator_user_search` | Search users |

### Projects

| Tool | Description |
|------|-------------|
| `phabricator_project_search` | Search projects |
| `phabricator_project_edit` | Edit a project |
| `phabricator_column_search` | Search workboard columns |

### Pastes

| Tool | Description |
|------|-------------|
| `phabricator_paste_search` | Search pastes |
| `phabricator_paste_create` | Create a paste |

### Wiki (Phriction)

| Tool | Description |
|------|-------------|
| `phabricator_document_search` | Search wiki documents |
| `phabricator_document_edit` | Edit a wiki document |

### PHID Utilities

| Tool | Description |
|------|-------------|
| `phabricator_phid_lookup` | Look up PHIDs by name (e.g., "T123", "@username") |
| `phabricator_phid_query` | Get details about PHIDs |

## Development

```bash
git clone https://github.com/freelancer/phabricator-mcp.git
cd phabricator-mcp
npm install
npm run build
npm run dev  # watch mode
```

### Architecture

- `src/index.ts` - Entry point, MCP server with stdio transport
- `src/config.ts` - Config loader (reads `~/.arcrc` or env vars)
- `src/client/conduit.ts` - Phabricator Conduit API client
- `src/tools/*.ts` - Tool implementations per Phabricator application

## License

MIT
