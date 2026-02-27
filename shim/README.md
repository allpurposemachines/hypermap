# HyperMap Shim

Browser parser and runtime for [HyperMap](https://www.hypermap.dev). Parses HyperMap
JSON responses and executes their embedded scripts, turning API data into living,
reactive objects in the browser.

HyperMap is a JSON format for REST APIs that uses a single reserved key, `#`, to
carry hypermedia controls and executable scripts. The shim is what makes that
work in a browser — it reads the JSON, builds the HyperMap tree, and runs any
scripts the server included.

For full documentation, see [hypermap.dev/docs](https://www.hypermap.dev/docs/).

## Install

```sh
npm install @hypermap/shim
```

Or load from a CDN:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@hypermap/shim@0.7.0/+esm"></script>
```

## Usage

Serve your HyperMap JSON as an HTML page with the shim and the data in a `<pre>`
tag (which is the default rendering for JSON content types in Chrome and Safari):

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@hypermap/shim@0.7.0/+esm"></script>
  </head>
  <body>
    <pre>{"#": {"scripts": ["/my-script.js"]}, "hello": "world"}</pre>
  </body>
</html>
```

## Development

The repo's [Caddyfile](../Caddyfile) serves this directory on `localhost:4000`
with HTTPS. Start Caddy from the repo root:

```sh
caddy run
```

Tests are browser-based — open `tests/index.html` after starting Caddy.

## License

MIT — see [LICENSE](LICENSE).
