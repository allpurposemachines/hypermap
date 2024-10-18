---
layout: layouts/docs.njk
---

# About HyperMap and Mech

## HyperMap

HyperMap is a simple standard for making REST resources living, computational
objects, capable of using the full set of Web APIs.

HyperMap is designed to be:
* Simple to adopt for existing REST APIs (just change the `Content-Type`)
* Easy to program, adding only a small set of attributes to JSON and allowing
  scripting with a mini DOM-like model
* Part of the Web ecosystem, capable of importing ESM modules that don't rely on
  the HTML DOM

## Mech

Mech is a universal client for all HyperMap services. Just as a Web browser
allows a human to interact with any Web site, Mech allows programs to interact
with any HyperMap service.

The goal is to provide an idiomatic, no-boilerplate experience in all langauges
and environments.

Mech is built as a collection of front-end langauge bindings and back-end
browser contexts with a HyperMap shim. The current prototype is a JavaScript
(with TypeScript type declarations) front-end with a headless Chrome back-end.
Other back-ends are planned:

* iFrames to run in Web browsers
* Webviews to run in iOS or sandboxed Mac apps
* An in-memory, embeddable library (possibly built on
  [Servo](https://servo.org))

## Talks

### Nordic APIs Platform Summit 2023

<div>
  <iframe
    class="w-full aspect-video"
    src="https://www.youtube.com/embed/gZvaginNdRU?si=SLKtJiGi7n0Z1CPJ"
    title="YouTube video player"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen>
  </iframe>
</div>
