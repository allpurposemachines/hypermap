# Spec Errata — Implementation Gaps

Where the current implementation (`shim/`) diverges from the spec.

## Scripts

- **Script scoping**: The spec says each script's `hypermap` global references
  the declaring MapNode. The implementation sets `globalThis.hypermap` to the
  root Hypermap for all scripts.

- **Scripts on any MapNode**: The spec allows `scripts` on any MapNode. The
  implementation only loads scripts from the root Hypermap node.

- **Reactive script loading**: The spec says mutations to a node's `attributes`
  (e.g., modifying the `scripts` array) trigger script loading. The
  implementation exposes `attributes` as a readable object but does not
  observe mutations to it — changes have no effect at runtime.

- **Script cancellation on node removal**: The spec says pending script loads
  are cancelled when a node is removed. Not implemented.

- **Script isolation**: The spec recommends isolating script execution contexts
  (e.g., SES compartments). Not implemented — all scripts share `globalThis`.

## Fetching and Navigation

- **Form response handling**: The spec describes handling both redirect (3xx)
  and direct (2xx) responses. The implementation only handles redirects
  (navigates to `response.url`).

## Data Model

- **`Hypermap.document`**: The spec defines a `document` attribute on Hypermap
  referencing the host Document. Not implemented.

- **Event capture phase**: The spec defines full DOM event dispatch (capture,
  target, bubble phases). The implementation only dispatches in the bubble
  phase — listeners registered with `capture: true` are never invoked.

- **Mutation event target**: The spec dispatches mutation events on `window`.
  This matches the implementation but the spec notes this may change to
  dispatch on the modified node with bubbling.

- **`toJSON()` / `toView()` split**: The spec defines `toJSON()` as lossless
  (includes full `#` attributes, round-trips through `fromJSON()`) and
  `toView()` as lossy (replaces `#` with `{"type": "control"}`). The
  implementation's current `toJSON()` behaves like the spec's `toView()` —
  it needs to be renamed, and a lossless `toJSON()` needs to be added.

- **`CollectionNode` shared members**: The spec defines CollectionNode with
  shared members (`size`, `toJSON()`, `toView()`). The implementation has an
  empty class — shared members need to be pulled up from MapNode/ListNode.

- **No iteration protocol**: Neither MapNode nor ListNode expose `keys()`,
  `entries()`, `forEach()`, or `Symbol.iterator`. Scripts access `innerMap`
  directly to iterate.

## Security

- **Script credential stripping**: The spec says script-initiated requests
  (fetch, WebSocket, etc.) MUST NOT include cookies, Referer headers, or
  Authorization headers. The implementation uses default `fetch()` behavior
  in scripts, which includes cookies and referrer for same-origin requests.
  (User agent requests during navigation correctly include credentials.)

- **`parentNode` traversal**: The spec says scripts must not traverse above
  their declaring node. The implementation exposes `parentNode` with no
  restriction — any script can walk to the root.

- **No `window`/`document` isolation**: The spec says scripts should not have
  direct access to `window` or `document`. The implementation runs scripts in
  the page's global scope with full access to everything.
