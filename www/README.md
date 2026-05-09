# Website

Source for [hypermap.dev](https://www.hypermap.dev). Built with
[Eleventy](https://www.11ty.dev/) on Node.

## Setup

```sh
nvm use
npm install
```

## Development

```sh
npm run serve
```

Builds the site and starts a local server with live reload.

## Building

```sh
npm run build
```

Output is written to `_site/`.

Both `build` and `serve` run `make -C ../spec` first, so
[Bikeshed](https://speced.github.io/bikeshed/) must be installed (via `uv` or
`pipx`).

## License

CC BY 4.0 — see [LICENSE](LICENSE).
