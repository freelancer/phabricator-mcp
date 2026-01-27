# phabricator-mcp

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that wraps Phabricator's Conduit API, enabling Claude Code and other MCP clients to interact with Phabricator tasks, code reviews, repositories, and more.

## Quick Start

### Using npx (recommended)

```bash
claude mcp add phabricator -- npx phabricator-mcp
```

### Using npm global install

```bash
npm install -g phabricator-mcp
claude mcp add phabricator -- phabricator-mcp
```

### From source

```bash
git clone https://github.com/freelancer/phabricator-mcp.git
cd phabricator-mcp
npm install && npm run build
claude mcp add phabricator -- node /path/to/phabricator-mcp/dist/index.js
```

## Configuration

The server automatically reads configuration from `~/.arcrc` (created by [Arcanist](https://secure.phabricator.com/book/phabricator/article/arcanist/)). No additional configuration is needed if you've already set up `arc`.

Alternatively, set environment variables (which take precedence over `.arcrc`):

```bash
export PHABRICATOR_URL="https://phabricator.example.com"
export PHABRICATOR_API_TOKEN="api-xxxxxxxxxxxxx"
```

You can get an API token from your Phabricator instance at: **Settings > Conduit API Tokens**

### Claude Code with environment variables

```bash
claude mcp add phabricator \
  -e PHABRICATOR_URL=https://phabricator.example.com \
  -e PHABRICATOR_API_TOKEN=api-xxxxx \
  -- npx phabricator-mcp
```

Or edit `~/.claude/settings.json` directly:

```json
{
  "mcpServers": {
    "phabricator": {
      "command": "npx",
      "args": ["phabricator-mcp"],
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

## Examples

### Search for open tasks assigned to you

```
Use phabricator_task_search with queryKey "assigned"
```

### Create a new task

```
Use phabricator_task_create with:
- title: "Fix login bug"
- description: "Users can't log in on mobile"
- priority: "high"
```

### Find a user's PHID

```
Use phabricator_phid_lookup with names: ["@username"]
```

### Search tasks in a project

First get the project PHID:
```
Use phabricator_project_search with constraints.name: "My Project"
```

Then search tasks:
```
Use phabricator_task_search with constraints.projectPHIDs: ["PHID-PROJ-xxx"]
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck

# Watch mode
npm run dev
```

## License

MIT
