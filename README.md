# HyperMap

**HyperMap** is a JSON format for REST APIs built around a single reserved key,
`#`, that carries hypermedia controls and executable scripts. Resources link to
each other, forming a tree where values change, events bubble up, and JavaScript
ships from the server and runs on the client in isolation.

**Mech** is the client that speaks it — available for browser environments or as
a POSIX daemon. There's no separate spec to write and no client to generate —
each resource describes itself, and Mech understands them all.

For documentation and getting started, visit
[hypermap.dev/docs](https://www.hypermap.dev/docs/).

## Packages

| Directory | Description | Stack |
| --------- | ----------- | ----- |
| [shim](shim/) | Browser parser & runtime for HyperMap | [npmx](https://npmx.dev/package/@hypermap/shim) |
| [mech_browser](mech_browser/) | Browser client library for HyperMap services | [npmx](https://npmx.dev/package/@hypermap/mech) |
| [mech_posix](mech_posix/) | CLI client & daemon using Servo | Rust |
| [example_server](example_server/) | Demo server showcasing HyperMap features | Deno |
| [explorer](explorer/) | Interactive HyperMap explorer UI | HTML |
| [spec](spec/) | The HyperMap specification | Bikeshed |
| [www](www/) | Website ([hypermap.dev](https://www.hypermap.dev)) | Lume / Deno |

## Development

Each package uses its own tooling — see the README in each directory for build
and development instructions.

Local development uses [Caddy](https://caddyserver.com/) to serve packages over
HTTPS with locally-trusted certificates, so you're always developing with
cross-origin in mind. Start Caddy from the repo root:

```sh
caddy run
```

This serves the shim on `localhost:4000` and reverse-proxies the example server
on `localhost:4001`, both with TLS.

See [AGENTS.md](AGENTS.md) for build commands and code style guidelines.

## Status

Both the HyperMap standard and Mech are in prototype stage. Expect significant
changes!

## Contributing

If you are considering contributing to HyperMap, thank you! The project is very
young and there are no set processes in place at the moment. Please use GitHub's
discussions, issues, and pull requests as normal. If you want to jump on a video
call to discuss the project in person, feel free to reach out to
<daniel@auxilit.com> or introduce yourself on
[Bluesky](https://bsky.app/profiles/auxilit.com).

Please read our [Code of Conduct](CODE_OF_CONDUCT.md).
