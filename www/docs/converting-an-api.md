---
layout: layouts/docs.njk
---

# Converting an API to HyperMap

HyperMap is designed to make it straightforward to take your existing APIs and progressively enhance them.
This tutorial walks through converting a simple RESTful todo service with a couple of resources:

- `/todos/` — GET, POST
- `/todos/:id` — GET, PATCH, DELETE

## Content Type

First, let's look at the current API:

```sh
% curl localhost:8000/
[]

% curl -X POST localhost:8000/ -d '{"title": "Learn HyperMap"}' | jq
[
  {
    "title": "Learn HyperMap",
    "completed":false,
    "id":"5J0rwwsyh"
  }
]

% curl -I localhost:8000/
HTTP/1.1 200 OK
content-type: application/json;
...
```

To turn this into a HyperMap service we need to make a few changes.

First, change the content type from `application/json` to `application/vnd.hypermap+json`:

```sh
% curl -I localhost:8000/
HTTP/1.1 200 OK
content-type: application/vnd.hypermap+json;
...
```

Second, all HyperMap responses must have a JSON object at their top level.
The todos resource currently returns a bare array, so we'll wrap it:

```sh
% curl localhost:8000/
{
  "todos": [
    {
      "title": "Learn HyperMap",
      "completed": false,
      "id": "5J0rwwsyh"
    }
  ]
}
```

That's all you need for a compliant HyperMap service — update the content type and ensure the top level is an object.

### HTML Delivery

Clients that request `application/vnd.hypermap+json` get the raw JSON response above.
But HyperMap services should also support browser-based user agents.
When a client accepts `text/html`, the server wraps the same JSON in an HTML document that loads a user agent script (often called the "shim").
The shim parses the embedded JSON, constructs the HyperMap node tree, and manages its lifecycle:

```javascript
function template(body) {
  return `<!DOCTYPE html>
    <html>
      <head>
        <script type="module"
          src="https://cdn.jsdelivr.net/npm/@hypermap/shim@0.7.0/+esm">
        </script>
      </head>
      <body>
        <pre>${JSON.stringify(body)}</pre>
      </body>
    </html>
  `;
}
```

Your endpoint returns `template({ todos: [...] })` when the client accepts HTML.
This gives you two representations of the same resource: raw JSON for programmatic clients, and an HTML host for browser-based user agents.

## Mech

There are two common ways to consume a REST API: manually hit HTTP endpoints and parse responses, or use a service-specific SDK.
HyperMap introduces a third option: **mech**, a universal client for any HyperMap service.
Mech is available as a browser client with a JavaScript interface, or as a POSIX daemon and CLI.
We'll use the CLI here.

Start the daemon, then open your service:

```sh
% mech start
% mech open http://localhost:8000/ --name todos
% mech show todos
todos/
  [0]/
    title: Learn HyperMap
    completed: false
    id: 5J0rwwsyh
```

`mech show` renders HyperMap content as an indented tree. Each line tells you what kind of node you're looking at:

- `key: value` — a leaf node with a scalar value
- `key/` — a container with children (the `/` indicates nesting)
- `key@` — a control that can be triggered with `mech use`
- `key@/` — a control that also has children (e.g. a form with fields)

## Controls

The service currently has two resources: the todo list and individual todos.
Let's look at a single todo:

```sh
% curl localhost:8000/todos/5J0rwwsyh | jq
{
  "title": "Learn HyperMap",
  "completed": false,
  "id": "5J0rwwsyh",
  "createdAt": "2023-05-10T15:15:59.568Z",
  "updatedAt": "2023-05-10T15:15:59.568Z"
}
```

Right now there's no connection from the list view to individual todos.
To see the timestamps we'd need to parse the `id`, construct a new URL, and fetch it.
Instead, we can add a **control** — any JSON object whose `#` attributes include an `href`:

```sh
% curl localhost:8000/
{
  "todos": [
    {
      "#": { "href": "5J0rwwsyh/" },
      "title": "Learn HyperMap",
      "completed": false
    }
  ]
}
```

The `#` key is reserved in HyperMap's JSON serialization. Its value is an attributes object that can contain:

- **`href`** — a URL (absolute or relative). Its presence makes this object a control.
- **`method`** — an HTTP method (defaults to `"GET"`).
- **`scripts`** — an array of script URLs to load and execute.

> Use trailing slashes on all routes in a HyperMap service — the rules for resolving relative URLs without one can catch you out.

Now mech can follow that link:

```sh
% mech show todos
todos/
  [0]@/
    title: Learn HyperMap
    completed: false

% mech use todos:todos/0
% mech show todos
title: Learn HyperMap
completed: false
id: 5J0rwwsyh
createdAt: 2023-05-10T15:15:59.568Z
updatedAt: 2023-05-10T15:15:59.568Z
```

Notice the `@/` on `[0]` — that tells us it's both a control (navigable) and a container (has children).

By default, mech performs a `GET` on the control's `href`.
We can add controls with other methods too.
For controls with a method that sends a body (like `POST`), the child nodes of the control serve as form fields:

```sh
% curl localhost:8000/
{
  "todos": [
    {
      "#": { "href": "5J0rwwsyh/" },
      "title": "Learn HyperMap",
      "completed": false
    }
  ],
  "newTodo": {
    "#": { "href": "/todos/", "method": "POST" },
    "title": ""
  }
}
```

In mech, we can submit inline values with `mech use`:

```sh
% mech show todos
todos/
  [0]@/
    title: Learn HyperMap
    completed: false
newTodo@/
  title:

% mech use todos:newTodo title="Add HyperMap to all my APIs"
% mech show todos
todos/
  [0]@/
    title: Learn HyperMap
    completed: false
  [1]@/
    title: Add HyperMap to all my APIs
    completed: false
newTodo@/
  title:
```

Or set fields individually before submitting:

```sh
% mech set todos:newTodo/title "Buy milk"
% mech use todos:newTodo
```

## Scripts

One of the most powerful features of HyperMap is shipping JavaScript to run on the client.
This lets you add dynamic elements to services, or offload intensive or private computation, freeing server resources.

Let's add a "dueAt" time to our todos and a script that counts how many tasks are overdue:

```sh
% curl localhost:8000/
{
  "#": {
    "scripts": ["/assets/overdue_checker.js"]
  },
  "overdue": 0,
  "todos": [
    {
      "#": { "href": "5J0rwwsyh/" },
      "title": "Learn HyperMap",
      "completed": false,
      "dueAt": "2023-05-10T16:18:49.244Z"
    }
  ],
  "newTodo": {
    "#": { "href": "/todos/", "method": "POST" },
    "title": ""
  }
}
```

Scripts are scoped to the `MapNode` that declares them.
Inside a script, the `hypermap` global refers to the root Hypermap instance.
You navigate the tree with `nodeFromPath()` and `.at()`, and update values with `.set()`:

```javascript
// /assets/overdue_checker.js
setInterval(() => {
  let counter = 0;
  const now = new Date();

  hypermap.nodeFromPath(["todos"]).innerMap.forEach(todo => {
    const completed = todo.at("completed").value;
    const dueAt = new Date(todo.at("dueAt").value);
    if (!completed && dueAt < now) {
      counter += 1;
    }
  });

  hypermap.set("overdue", new HypermapShim.ValueNode(counter));
}, 1000);
```

When you're done, clean up:

```sh
% mech close todos
% mech stop
```
