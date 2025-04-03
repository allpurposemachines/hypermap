// @ts-nocheck
import { HypermapShim } from './hypermap_shim.js';
globalThis.HypermapShim = HypermapShim;

const pre = document.body.querySelector('pre');
if (pre) {
	const serializedHypermap = pre.innerHTML;
	const jsonHypermap = JSON.parse(serializedHypermap);

	globalThis.hypermap = HypermapShim.Hypermap.fromLiteral(jsonHypermap);
	globalThis.hypermap.hydrate().then(() => {
		if (globalThis.contentChanged) {
			globalThis.contentChanged();
		}
	});

	globalThis.serializedHypermap = () => {
		return JSON.parse(JSON.stringify(globalThis.hypermap));
	};
} else {
	console.log('No pre element');
}

globalThis.setHypermap = function(mapNode) {
	globalThis.hypermap = new HypermapShim.Hypermap(mapNode);
	globalThis.hypermap.parent = globalThis;
	return globalThis.hypermap.start();
};

globalThis.addEventListener('use', (event) => {
	if (event.defaultPrevented) {
		return;
	}

	const attrs = event.detail.target.attributes;
	if (attrs.href) {
		globalThis.location = attrs.href;
	}
});
