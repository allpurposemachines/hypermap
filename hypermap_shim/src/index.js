// @ts-nocheck
import { Hypermap } from './Hypermap.js';

const pre = document.body.querySelector('pre');
if (pre) {
	const serializedHypermap = pre.innerHTML;
	const jsonHypermap = JSON.parse(serializedHypermap);

	globalThis.hypermap = Hypermap.fromLiteral(jsonHypermap);
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
