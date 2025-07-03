import { HypermapShim } from './hypermap_shim.js';
globalThis.HypermapShim = HypermapShim;

globalThis.setHypermap = function(mapNode) {
	globalThis.hypermap = new HypermapShim.Hypermap(mapNode);
	globalThis.hypermap.parent = globalThis;
	return globalThis.hypermap.start();
};

const pre = document.body.querySelector('pre');
if (pre) {
	globalThis
		.setHypermap(HypermapShim.Hypermap.fromJSON(pre.innerHTML))
		.then(() => {
			const message = {
				type: 'mutation',
				data: globalThis.hypermap
			};
			parent.window.postMessage(JSON.stringify(message), "*");
		});
} else {
	console.log('No pre element');
}

globalThis.addEventListener('mutation', (_event) => {
	if(pre) {
		pre.innerText = JSON.stringify(globalThis.hypermap, null, 2);
	}
	const message = {
		type: 'mutation',
		data: globalThis.hypermap
	};
	parent.window.postMessage(JSON.stringify(message), "*");
})

globalThis.addEventListener('use', (event) => {
	if (event.defaultPrevented) {
		return;
	}

	const attrs = event.detail.target.attributes;
	if (attrs.href) {
		const newUrl = new URL(attrs.href, window.location.href);
		window.location.assign(newUrl);
	}
});

globalThis.addEventListener('message', event => {
	const data = JSON.parse(event.data);
	if (data.type == 'use') {
		globalThis.hypermap.use(data.path);
	}
	if (data.type == 'input') {
		globalThis.hypermap.input(data.path, data.value);
	}
});
