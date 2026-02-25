---
layout: layouts/docs.njk
---

# Why HyperMap

The web is a graph of linked documents. You click a link, you're somewhere new.
You don't need a map of the whole web to navigate it. Crawlers index it. Search
engines rank it. It works because pages know about each other.

APIs aren't like this. They're islands. You call an endpoint, you get data back,
you're done. To use three APIs together, you read three sets of docs, write three
integrations, maintain three clients. Nothing links to anything. There's no
traversal. No discovery. No graph. We've been building APIs this way for twenty
years. It was always wrong.

## What HyperMap does differently

A HyperMap response is JSON with a reserved `#` key that provides three things:

- **Hypermedia controls.** The `#` key can hold an href (a link to another
  resource), a method (a form for write operations), or define behaviour that
  clients can act on. Resources point to related resources — on the same server
  or across the web. Clients follow them. Crawlers index them. The API becomes
  an explorable graph.
- **Executable scripts.** Resources can include JavaScript that clients fetch and
  execute in a sandbox. Pagination, streaming, retries, transformation — shipped
  by the server, always current. When the server updates its logic, every client
  picks it up automatically.
- **A reactive data model.** HyperMap responses form a tree. When values change,
  events bubble up — like the DOM, but for API data. Clients subscribe to
  changes instead of polling.

```json
{
  "#": {
    "href": "/stocks/AAPL",
    "scripts": ["/js/price-stream.js"]
  },
  "ticker": "AAPL",
  "price": 187.42,
  "company": {
    "#": { "href": "/companies/AAPL" },
    "name": "Apple Inc."
  },
  "filings": {
    "#": { "href": "https://sec.hypermap.dev/companies/AAPL/filings" }
  }
}
```

A client — human or machine — can follow `company` to learn about Apple, follow
`filings` to reach SEC data on a completely different server, or let the
price-stream script push real-time updates. No docs required. No SDK. Just
follow the links, run the code.

## The landscape today

AI agents need to discover and use APIs without hand-holding. Here's what they
get today:

- **MCP** gives agents a flat list of tools. It works for simple cases, but
  tools don't link to each other, there's no code-on-demand, and each API needs
  a separate wrapper server with its own auth and deployment. As the number of
  tools grows, the tool schemas themselves become a scaling problem — tens of
  thousands of tokens in the context window before any reasoning happens.
- **OpenAPI** describes endpoints with schemas, but statically. No traversal, no
  executable behaviour, no links between services.
- **GraphQL** offers a query language over a single endpoint, but still no links
  between services and no client-side logic.
- **Raw REST** works if you've read the docs. Agents haven't.

Agents need a web of APIs they can explore. HyperMap gives them one.

But this isn't only about agents. The same properties that let an AI explore —
links, self-description, executable behaviour — make APIs better for developers,
scripts, and integrations. An agent can explore a HyperMap API dynamically to
understand it, then write a lightweight script for ongoing work. The format
bridges discovery and automation.
