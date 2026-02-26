---
layout: layouts/docs.njk
---

# About HyperMap and Mech

## HyperMap

HyperMap is a simple standard for making REST resources living, computational
objects, capable of using the full set of Web APIs.

HyperMap is designed to be:

* Simple to adopt for existing REST APIs
* Easy to program, adding only a small set of attributes to JSON and allowing
  scripting with a mini DOM-like model
* Part of the Web ecosystem, capable of importing ESM modules that don't rely on
  the HTML DOM

## Mech

Mech is a universal client for all HyperMap services. Just as a Web browser
allows a human to interact with any Web site, Mech allows programs to interact
with any HyperMap service.

The goal is to provide an idiomatic, no-boilerplate experience in all languages
and environments.

There are two current implementations of Mech depending on the environment:

* a browser client and JavaScript interface which uses iFrames for isolation
* a POSIX daemon and CLI built on [Servo](https://servo.org)

## Talks

### Nordic APIs Platform Summit 2023

<div>
  <iframe
    class="video-embed"
    src="https://www.youtube.com/embed/gZvaginNdRU?si=SLKtJiGi7n0Z1CPJ"
    title="YouTube video player"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen>
  </iframe>
</div>
