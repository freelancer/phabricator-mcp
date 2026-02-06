# phabricator-mcp

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that wraps Phabricator's Conduit API, enabling any MCP client to interact with Phabricator tasks, code reviews, repositories, and more.

## Installation

### Claude Code (CLI)

```bash
claude mcp add --scope user phabricator -- npx github:freelancer/phabricator-mcp
```

Or with environment variables (if not using `~/.arcrc`):

```bash
claude mcp add --scope user phabricator \
  -e PHABRICATOR_URL=https://phabricator.example.com \
  -e PHABRICATOR_API_TOKEN=api-xxxxx \
  -- npx github:freelancer/phabricator-mcp
```

The `--scope user` flag installs the server globally, making it available in all projects.

### Codex (OpenAI CLI)

Add to your Codex config (`~/.codex/config.json`):

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

### opencode

Add to your opencode config (`~/.config/opencode/config.json`):

```json
{
  "mcp": {
    "servers": {
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
}
```

### VS Code with Claude Extension

Add to your VS Code `settings.json`:

```json
{
  "claude.mcpServers": {
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

### Cursor

Add to your Cursor MCP config (`~/.cursor/mcp.json`):

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

### GitHub Copilot (VS Code)

Add to your VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
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

## Configuration

The server automatically reads configuration from `~/.arcrc` (created by [Arcanist](https://secure.phabricator.com/book/phabricator/article/arcanist/)). No additional configuration is needed if you've already set up `arc`.

Alternatively, set environment variables (which take precedence over `.arcrc`):

- `PHABRICATOR_URL` - Phabricator instance URL
- `PHABRICATOR_API_TOKEN` - Conduit API token

You can get an API token from your Phabricator instance at: **Settings > Conduit API Tokens**

### Recommended: Allow Read-Only Tool Permissions

By default, Claude Code will prompt you for permission each time a Phabricator tool is called. It's recommended to allowlist the read-only tools so they run without prompts, while keeping write operations (create, edit, comment) behind a confirmation step.

Add to your `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__phabricator__phabricator_task_search",
      "mcp__phabricator__phabricator_revision_search",
      "mcp__phabricator__phabricator_diff_search",
      "mcp__phabricator__phabricator_get_raw_diff",
      "mcp__phabricator__phabricator_repository_search",
      "mcp__phabricator__phabricator_commit_search",
      "mcp__phabricator__phabricator_user_whoami",
      "mcp__phabricator__phabricator_user_search",
      "mcp__phabricator__phabricator_project_search",
      "mcp__phabricator__phabricator_column_search",
      "mcp__phabricator__phabricator_paste_search",
      "mcp__phabricator__phabricator_document_search",
      "mcp__phabricator__phabricator_phid_lookup",
      "mcp__phabricator__phabricator_phid_query"
    ]
  }
}
```

To allowlist all tools including write operations, use `"mcp__phabricator__*"` instead.

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
| `phabricator_get_raw_diff` | Get the raw diff/patch content for a diff by ID |
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

## Usage

Once connected, just ask your AI assistant to perform Phabricator tasks in natural language:

**Tasks**
- "Show my assigned tasks"
- "Create a task titled 'Fix login bug' in project Backend"
- "Add a comment to T12345 saying the fix is ready for review"
- "Close task T12345"

**Code Reviews**
- "Show my open diffs"
- "What's the status of D6789?"
- "Review the code changes in D6789"
- "Add @alice as a reviewer to D6789"

**Search & Lookup**
- "Find user john.doe"
- "Search for projects with 'backend' in the name"
- "Search commits by author alice"
- "Look up T123 and D456"

**Wiki & Pastes**
- "Find wiki pages about deployment"
- "Create a paste with this error log"

The appropriate tools are called automatically based on your request.

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
