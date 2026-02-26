# AGENTS.md

## Build & Run Commands
- **Example server**: `MODE=DEV deno run --allow-net --allow-read --allow-env --watch=. example_server/app.ts`
- **Local dev server**: `caddy run` from repo root (serves shim on :4000, proxies example server on :4001, both with TLS)
- Tests are browser-based in `hypermap_shim/tests/`

## Architecture
- **mech_browser/**: Universal HyperMap client library (browser JS, uses iframes + postMessage)
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
