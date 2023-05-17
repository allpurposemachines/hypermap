# HyperMap

## About

HyperMap is a new RESTful API standard.
HyperMap services are easier to build and use than traditional REST services, while being significantly more powerful and dynamic.

Mech is a universal client that can talk to any HyperMap service. It removes the need to build client wrappers/SDKs for every service.
It is currently shipped as an NPM package with JavaScript bindings.

## Status

Both the HyperMap standard and Mech are in prototype stage. Expect significant changes.

## Getting started

Take a look at the tutorial in `/docs`, the server in `/example_server`, and `/mech/tests/test.js`.

There is a hosted verison of the example server at [https://hypermap-example.deno.dev/](https://hypermap-example.deno.dev/). To run the example locally install [Deno](https://deno.com/runtime) and then run:

```sh
$ deno run --allow-net --allow-read --watch=. example_server/app.ts
```

There is a [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=all-purpose-machines.apm-explorer) for browsing HyperMap services and generated stub Mech code.

## Contributing

Firstly, If you are considering contributing to HyperMap, thank you!
The project is very young and there are no set proceses in place at the moment.
Please use GitHub's discussions, issues, and pull requests as normal.
If you want to jump on a video call to discuss the project in person, feel free to reach out to daniel@allpurposemachines.com.
