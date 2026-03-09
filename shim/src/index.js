import { HypermapShim } from './hypermap_shim.js';
globalThis.HypermapShim = HypermapShim;

globalThis.setHypermap = function(mapNode) {
	globalThis.hypermap = new HypermapShim.Hypermap(mapNode);
	globalThis.hypermap.parentNode = globalThis;
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

globalThis.HypermapHelpers = {
	navTo: (url) => {
		window.location.assign(url);
	}
};

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

function controlData(control) {
	const data = JSON.parse(JSON.stringify(control));
	delete data['#'];
	return data;
}

globalThis.addEventListener('use', (event) => {
	if (event.defaultPrevented) {
		return;
	}

	const control = event.detail.target;
	const attrs = control.attributes;
	if (attrs.href) {
		if (attrs.method) {
			fetch(attrs.href,
				{
					method: attrs.method,
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify(controlData(control))
				}).then(response => {
					HypermapHelpers.navTo(response.url);
				});
		} else {
			const url = new URL(attrs.href, window.location.href);
			for (const [key, value] of Object.entries(controlData(control))) {
				url.searchParams.set(key, value);
			}
			HypermapHelpers.navTo(url.toString());
		}
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
