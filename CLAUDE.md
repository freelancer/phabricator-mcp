# CLAUDE.md

## Project Overview

MCP server wrapping Phabricator's Conduit API. TypeScript, Zod schemas, `@modelcontextprotocol/sdk`.

## Key Directories

- `src/tools/` - Tool implementations, one file per Phabricator app
- `src/client/conduit.ts` - Conduit API client
- `src/config.ts` - Config loader (~/.arcrc / env vars)
- `docs/index.html` - GitHub Pages documentation site
- `README.md` - Primary documentation

## Build & Dev

```bash
npm run build      # tsc
npm run typecheck   # tsc --noEmit
npm run dev         # tsx --watch
npm test            # tsx --test
```

Tests use `node:test` and live next to the code as `src/**/*.test.ts`.

## Documentation Rules

**When adding, removing, or modifying tools, always update ALL THREE of these:**

1. **`README.md`** - Tool table, permissions allow list, usage examples
2. **`docs/index.html`** - Tool count (in og:description, JSON-LD, h2 heading, FAQ), tool grid, permissions allow list
3. **`src/tools/index.ts`** - Tool registration (if adding a new tool file)

The site (`docs/index.html`) is a single static HTML file served via GitHub Pages. It contains tool counts in multiple places (meta tags, JSON-LD structured data, heading, FAQ) - update all of them when the tool count changes.

## Patterns

- Every tool follows: `server.tool(name, description, zodSchema, asyncHandler)`
- Edit tools use transactions: `{ type: string, value: unknown }[]` passed to `*.edit` Conduit methods
- Use `jsonCoerce()` wrapper on object/record Zod schemas (handles JSON string inputs from some MCP clients)
- Tool names are prefixed with `phabricator_`
- Return format: `jsonResult(result)` from `src/tools/result.ts` (compact JSON, null/empty properties dropped)
