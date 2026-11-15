---
layout: layouts/home.njk
heading: HyperMap
subheading: Putting the <strong>Web</strong> back into <strong>Web Services</strong>
---
The API is finished. It was built for a world where humans read the docs, pinned
a version, and upgraded once a year. Agents don’t read docs and don’t wait.
*HyperMap* is a hypermedia format that gives data the Web’s own architecture:
every response carries its own links, actions, and code, so a service can constantly
evolve.

<div class="cta-links">
<a href="/docs/">Get started &rarr;</a>
</div>

## Mech

A user agent for HyperMap. Runs as a Posix daemon with a CLI.

<div class="artifact-callouts">
  <a href="https://github.com/allpurposemachines/hypermap/tree/main/mech_posix" class="artifact">
    <strong>Mech</strong> <span>CLI &amp; daemon &middot; v0.1.0</span>
  </a>
</div>

## Browser support

HyperMap in today’s browsers. A client library for pages, plus a small server
component every service runs alongside its resources. Temporary, until browsers
support HyperMap natively.

<div class="artifact-callouts">
  <a href="https://npmx.dev/package/@hypermap/shim" class="artifact">
    <strong>browser shim (server)</strong> <span>v0.7.0</span>
  </a>
  <a href="https://npmx.dev/package/@hypermap/mech" class="artifact">
    <strong>browser shim (client)</strong> <span>v0.10.0</span>
  </a>
</div>
