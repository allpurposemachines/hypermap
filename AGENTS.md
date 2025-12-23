# AGENTS.md

## Build & Run Commands
- **Example server**: `MODE=DEV deno run --allow-net --allow-read --allow-env --watch=. example_server/app.ts`
- **Shim dev server**: Serve `hypermap_shim/` on port 4000 (e.g., `npx http-server hypermap_shim -p 4000`)
- Tests are browser-based in `hypermap_shim/tests/` and `mech/tests/test.js`

## Architecture
- **mech/**: Universal HyperMap client library (browser JS, uses iframes + postMessage)
- **hypermap_shim/**: Browser shim that parses HyperMap JSON and runs embedded scripts
- **example_server/**: Demo Deno/Oak server showcasing HyperMap features
- **explorer/**: Simple HTML explorer UI

## Code Style
- **JS**: ES modules (`type: module`), no build step, classes extend EventTarget
- **TypeScript (Deno)**: Use JSR imports, Oak framework for HTTP
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Formatting**: Tabs for indentation in JS/TS
- **Error handling**: Try/catch with console.log for errors in async code
- **Exports**: Named exports preferred (`export const`, `export class`)
- **Strings**: Single quotes preferred (easier to embed JSON in code)
- **Private fields**: Use `#` for true privacy (ES2022), not `_` convention
- **Method naming**: Keep method names simple and idiomatic; validation is implied (e.g., `reparent()` instead of `_checkCycleAndReparent()`)
- **Setters**: Use idiomatic property setters instead of `_setX()` methods where appropriate
- **Internal methods**: Use `_attachChild()` / `_detachChild()` pattern for collection parent-child management
- **DRY refactoring**: Extract repeated validation/mutation patterns into shared methods
