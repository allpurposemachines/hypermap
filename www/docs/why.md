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
