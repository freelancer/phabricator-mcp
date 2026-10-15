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

Before opening a pull request, check the change against a Phabricator as `CONTRIBUTING.md` describes: unit tests cannot see a method, parameter or transaction type that the instance does not accept.

## Documentation Rules

**When adding, removing, or modifying tools, always update ALL of these:**

1. **`README.md`** - Tool table, permissions allow list, usage examples
2. **`docs/index.html`** - Tool grid, permissions allow list
3. **`src/tools/index.ts`** - Tool registration (if adding a new tool file)
4. **`src/tools/availability.ts`** - The Conduit methods the tool calls, so it is hidden on instances without them

The site (`docs/index.html`) is a single static HTML file served via GitHub Pages. Neither it nor the README gives a tool count: which tools an instance gets depends on the Conduit methods it offers.

## Patterns

- Every tool follows: `server.tool(name, description, zodSchema, annotations, asyncHandler)`, with `annotations` based on `READ_ONLY`, `ADDITIVE` or `DESTRUCTIVE` from `src/tools/annotations.ts`
- Edit tools use transactions: `{ type: string, value: unknown }[]` passed to `*.edit` Conduit methods
- Use `jsonCoerce()` wrapper on object/record Zod schemas (handles JSON string inputs from some MCP clients)
- Tool names are prefixed with `phabricator_`
- Return format: `jsonResult(result)` from `src/tools/result.ts` (compact JSON, null/empty properties dropped)
