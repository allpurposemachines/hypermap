# Example Server

A demo [HyperMap](https://www.hypermap.dev) server built with
[Deno](https://deno.com/runtime) and [Oak](https://jsr.io/@oak/oak).
Showcases code-on-demand scripts for sentiment analysis, live stock prices,
and order submission.

## Running

From the repository root:

```sh
MODE=DEV deno run --allow-net --allow-read --allow-env --watch=example_server/ example_server/app.ts
```

The server starts on port 8000.

In dev mode the shim is loaded from `localhost:4000`, so you will also need to
serve the [shim](../shim/) directory locally — see its README.

## License

MIT — see [LICENSE](LICENSE).
