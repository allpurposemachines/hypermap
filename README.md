# HyperMap

## About

HyperMap is a new RESTful API standard.
HyperMap services are easier to build and integrate than traditional REST services, while being significantly more powerful and dynamic.
HyperMap has three interesting properties:

1. It's self-descriptive (also known as hypermedia) — this lets you cut down on human readable documenation
   and elimiate machine readable specs by moving the metadata about using the API into the responses themselves. This also
   helps to make great developer tooling (check out the
   [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=all-purpose-machines.apm-explorer) as an example).

2. It supports code on demand — this means that you can send JavaScript or WebAssembly to the client to execute there, letting you do things like reacting to asynchronous data using
   `fetch`, SSEs, or WebSockets, or even moving whole computations to the client to improve
   performance or privacy. This is obviously an incredibly successful capability of the Web
   that hasn't been applied to REST APIs until now, despite being part of the [original list of REST constraints for over twenty years](https://en.wikipedia.org/wiki/REST#Code_on_demand_(optional))!

3. It's really easy to adopt — existing REST services can switch over to HyperMap just by changing the content type, and you can progressively adopt new features over time. Read the 
  [guide to converting an existing API](https://docs.allpurposemachines.com/converting-an-api/) for more information.

Mech is a universal client that can talk to any HyperMap service. It removes the need to build client wrappers/SDKs for every service. It's pretty minimal at the moment but if it
doesn't do something you need that's fine — it supports code on demand! Just have your API
send some JavaScript to add the capabilities you need for your service.

It currently has bindings for JavaScript and TypeScript, with more languages to come.

## Examples

There are some common headaches with APIs that HyperMap solves:

1.  Eliminate Webhooks — Webhooks are great for notifying a client that a long running process has completed but assumes you have a publicly reachable URL to POST back to. This
    isn't the case if you're developing native apps, developing locally, or running on CI.

    Instead, with HyperMap you can just create an EventSource and listen to SSEs:

    ```json
    {
      "@": {
        "script": "/eventHandler.js"
      },
      "ticketId": "2277",
      "status": "pending"
    }
    ```

    ```js
    const evtSource = new EventSource('/tickets/2277/events');

    evtSource.onmessage = (event) => {
      hypermap.set('status', event.data);
    };
    ```

    Apps looking to react to this change can just use an event handler through Mech:
    ```js
    const ticketTab = Mech.open("https://example.com/tickets/2277/");

    ticketTab.on("changed", () => {
      console.log(`New status: ${ticketTab.at("status")}`);
    });
    ```

2.  Unify REST and streaming endpoints — something that's increasingly common is to ship
    two APIs: a regular REST one for structured data and a WebSocket one for streaming data.
    With HyperMap you can have the best of both worlds:

    ```json
    {
      "@": {
        "script": "/streamHandler.js"
      },
      "aapl": 180.67,
      "meta": 321.91,
      "googl": 138.80
    }
    ```

    ```js
    const stockSocket = new WebSocket('wss://example.com/stocks/');

    stockSocket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      hypermap.set(msg.ticker, msg.price);
    };
    ```

3.  Client-side pre-processing — if you need to process data that's private or sensitive you
    might need to hard-code some logic in your wrapper/SDK to scrub that information before
    sending to your service. With HyperMap you can ship the logic to the client alongside the
    API reponse, ensuring it works in any supported language and is always up to date. See
    the privacy-preserving text sentiment analysis demo in the `example_server`.

## Status

Both the HyperMap standard and Mech are in prototype stage. Expect significant changes!

## Getting started

Take a look at the [documentation](https://docs.allpurposemachines.com/), the server in `/example_server`, and `/mech/tests/test.js`.

There is a hosted verison of the example server at [https://services.allpurposemachines.com/](https://services.allpurposemachines.com/). To run the example locally install [Deno](https://deno.com/runtime) and then run:

```sh
$ deno run --allow-net --allow-read --watch=. example_server/app.ts
```

There is a [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=all-purpose-machines.apm-explorer) for browsing HyperMap services and generated stub Mech code.

Join our [Discord server](https://discord.gg/csYd9ZU6Ng) if you have any questions not
covered in the documentation or hit any obstacles, or any feedback about how to make the
getting started process easier!

## Contributing

Firstly, If you are considering contributing to HyperMap, thank you!
The project is very young and there are no set proceses in place at the moment.
Please use GitHub's discussions, issues, and pull requests as normal.
If you want to jump on a video call to discuss the project in person, feel free to reach out to daniel@allpurposemachines.com or through the [Discord server](https://discord.gg/csYd9ZU6Ng).
