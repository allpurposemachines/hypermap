# Mech (Browser)

A universal browser client for [HyperMap](https://www.hypermap.dev) services. Just
as a web browser lets a human interact with any website, Mech lets programs
interact with any HyperMap service — no client SDK or code generation needed.

HyperMap is a JSON format for REST APIs that uses a single reserved key, `#`, to
carry hypermedia controls and executable scripts. Resources describe themselves,
link to each other, and ship code that runs on the client.

For full documentation, see [hypermap.dev/docs](https://www.hypermap.dev/docs/).

## Install

```sh
npm install @hypermap/mech
```

## Usage

```js
import '@hypermap/mech';

const tab = Mech.open('https://example.com/api/');

tab.addEventListener('changed', () => {
  console.log(tab.hypermap);
});

// Navigate a control
tab.use(['some', 'path']);

// Set a form input value
tab.input(['some', 'path'], 'value');
```

`Mech.open()` loads the URL in a hidden iframe and communicates with it via
`postMessage`. The returned `Tab` extends `EventTarget` and fires `changed`
events whenever the underlying HyperMap data updates.

## License

MIT — see [LICENSE](LICENSE).
