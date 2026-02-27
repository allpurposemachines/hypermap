---
layout: layouts/home.njk
heading: HyperMap
subheading: Putting the Web back into Web Services
---

**HyperMap** is a JSON format for REST APIs built around a single reserved key, `#`,
that carries hypermedia controls and executable scripts. Resources link to each
other, forming a minimalist, data-oriented DOM &mdash; a tree where values
change, events bubble up, and JavaScript or WebAssembly ships from the server and
runs on the client in OS-level process isolation.

<div class="artifact-callouts artifact-callouts--pair">
<a href="/spec/" class="artifact">
<strong>The Spec</strong>
<span>Format definition. OWFa 1.0.</span>
</a>
<a href="https://npmx.dev/package/@hypermap/shim" class="artifact">
<strong>HyperMap Shim</strong>
<span>Browser parser &amp; runtime. v0.7.0</span>
</a>
</div>

**Mech** is the client that speaks it &mdash; available for browser environments or
as a POSIX daemon. There's no separate spec to write and no client to generate
&mdash; each resource describes itself, and Mech understands them all.

<div class="artifact-callouts artifact-callouts--pair">
<a href="https://npmx.dev/package/@hypermap/mech" class="artifact">
<strong>Mech (Browser)</strong>
<span>Browser client. v0.10.0</span>
</a>
<a href="https://github.com/allpurposemachines/hypermap/tree/main/mech_posix" class="artifact">
<strong>Mech (POSIX)</strong>
<span>CLI &amp; daemon. v0.1.0</span>
</a>
</div>

## Built on REST

HyperMap is REST. Every resource has a URL, responds to standard HTTP methods,
and works with the infrastructure you already have &mdash; caching, CDNs,
proxies, auth. If you already serve a REST API, adopting HyperMap means adding
`#` keys to the JSON you already return. No wrapper service, no new protocol, no
second deployment.

## Explore, then automate

Resources carry their own controls, links, and executable scripts. An agent can
start at a URL and explore &mdash; following links, running scripts,
progressively discovering what's available. Then it can write a lightweight
integration for ongoing work. The same format that supports dynamic exploration
also supports low-overhead automation.

Network APIs don't need bespoke clients. They need to describe themselves.
That's what HyperMap does.

<div class="cta-links">
<a href="/docs/">Get started</a>
<a href="/docs/why/">Why HyperMap?</a>
<a href="https://github.com/allpurposemachines/hypermap/discussions">Discuss on GitHub</a>
</div>
