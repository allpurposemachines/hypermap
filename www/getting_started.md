---
layout: layouts/docs.njk
---

# Getting Started

HyperMap is an API standard for services that are easier to build and use than services with normal REST interfaces.

It's designed to be straightforward to take your existing APIs and progressively enhance them.
This tutorial will walk through the process of refactoring a simple todo service with a couple of resources:

- `/todos/` — GET, POST
- `/todos/:id` — GET, PATCH, DELETE

## Content Type

First, let's take a look at the current API:

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
access-control-allow-origin: *
content-type: application/json;
...
```

To turn this into a HyperMap service we first need to change the content type from `application/json` to `application/vnd.hypermap+json`.

```sh
% curl -I localhost:8000/
HTTP/1.1 200 OK
access-control-allow-origin: *
content-type: application/vnd.hypermap+json;
...
```

Second, all HyperMap responses must have a JSON "object" at their top-level.
The todos resource currently returns a bare array, so we'll fix that:

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

And that's it, we're done!
Updating the content type and ensuring that the top-level of responses is an "object" are all you need to build a compliant HyperMap service.
With that in place, we can start to take advantage of HyperMap's powerful features.

## Mech

There are two common ways to consume a REST API: manually hit HTTP endpoints and parse the JSON responses, or use a service-specific client (also known as a wrapper or SDK).
HyperMap introduces another option: use Mech. It's a client (or user agent) for any HyperMap service.

The plans is for Mech to support all possible languages, but for now it's JavaScript only. To get started, install the package:

```sh
npm install @allpurposemachines/mech
```

Mech has a very similar interface to a Web browser, complete with tabs!

> In fact, at the moment, it's implemented as a wrapper over headless Chrome using Puppeteer though this is likely to change.

Let's use Mech to connect to our service and inpsect our todos:

```javascript
import { Mech } from '@allpurposemachines/mech';

const mech = await Mech.launch();
const todosTab = await mech.newTab();
await todosTab.goto('localhost:8000/');

console.log(todosTab.at('todos').length()); // Output: 1
console.log(todosTab.at('todos', 0, 'title')); // Output: "Learn HyperMap"
```

Using tabs might feel odd at first but it will make sense once you're talking to a few different services, especially if they're dynamic.

## Controls

The service currently has two resources: a list of all todos, and the todos themselves.
Let's take a look at a single todo:

```sh
$ curl localhost:8000/todos/5J0rwwsyh | jq
{
  "title": "Learn HyperMap",
  "completed": false,
  "id": "5J0rwwsyh",
  "createdAt": "2023-05-10T15:15:59.568Z",
  "updatedAt": "2023-05-10T15:15:59.568Z"
}
```

There's some additional timestamp information that's not in the index view that we'd like to read.
Right now, there's no connection from the index view to the individual todos, so if we want to see that information in Mech we'd need to parse the "id" from the index view, construct a new URL with that "id" and then `goto` to the new URL. But there's a simpler way:

```sh
% curl localhost:8000/ | jq
{
  "todos": [
    {
      "@": {
        "href": "5J0rwwsyh/"
      }
      "title": "Learn HyperMap",
      "completed": false
    }
  ]
}
```

We've lifted the "id" into a new object under "@".
This a reserved key in HyperMap's JSON serialization that holds attributes, here being used for a relative "href".

> It's a good idea to use trailing slashs on all routes in a HyperMap service as the rules for resolving relative URLs without the trailing slash can catch you out.

That attribute turns this object into a control, and will serve as a hint to Mech about how to fetch the todo:

```javascript
await todosTab.at('todos').$(0);
console.log(todosTab.at('createdAt')); // Output: "2023-05-10T15:15:59.568Z"
```

By default, Mech will `GET` the resource, but we can include an additional attribute to tell it to use another HTTP method.
If it's a method which sends a body, like `PUT` or `POST`, the inner content of the control will be send too.

```sh
% curl localhost:8000/ | jq
{
  "todos": [
    {
      "@": {
        "href": "5J0rwwsyh/"
      }
      "title": "Learn HyperMap",
      "completed": false
    }
  ],
  "newTodo": {
    "title": "String"
  }
}
```

```javascript
await todosTab.goto('localhost:8000/');
await todosTab.$('newTodo', { title: 'Add HyperMap to all my APIs' });
```

## Scripts

One of the most powerful features of HyperMap services is that they support shipping JavaScript and Web Assembly to run on the client.
This lets us add dynamic elements to services, or even offload intensive or private computation to clients, freeing up server resources.
> In the original REST formulation, this was as optional constraint known as "code-on-demand"

Let's add a "dueAt" time to our todos, and a script to count of how many tasks are overdue:

```sh
% curl localhost:8000/ | jq
{
  "@": {
    script: "/assets/overdue_checker.js"
  }
  "overdue": 0,
  "todos": [
    {
      "@": {
        "href": "5J0rwwsyh/"
      }
      "title": "Learn HyperMap",
      "completed": false,
      "dueAt": "2023-05-10T16:18:49.244Z"
    }
  ],
  "newTodo": {
    "title": "String"
  }
}
```

```javascript
// /assets/overdue_checker.js
setInterval(() => {
  let counter = 0;
  const now = new Date();

  hypermap.at('todos').forEach(todo => {
    if (!todo.at('completed') && new Date(todo.at('dueAt')) < now) {
      counter = counter + 1;
    }
  });

  if (hypermap.at('overdue') !== counter) {
    hypermap.set('overdue', counter);
  }
}, 1000);
```

We can then add an event listener in our Mech tab to notify us if the counter changes:

```javascript
todosTab.addEventListener('changed', (event) => {
  if (event.detail.key === 'overdue') {
    console.log('Uh oh, another task is overdue...');
  }
});
```
