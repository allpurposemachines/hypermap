const isMap = (value) => {
	return typeof value === 'object' &&
	value !== null &&
	!Array.isArray(value)
};

class Hypermap extends EventTarget {
	attributes;
	map;

	constructor(data, attributes) {
		super();
		this.map = new Map(data);
		this.attributes = new Map(attributes);
	}

	static async fromJSON(object, scripts, transcludedNodes) {
		const entries = Object.entries(object);
		const attributes = entries.find(([key]) => key === "@")?.at(1) || {};
		const data = entries.filter(([key]) => key !== "@");

		let hypermap = new Hypermap(data, Object.entries(attributes));
		hypermap.forEach(async (value, key) => {
			if (isMap(value)) {
				hypermap.set(key, await this.fromJSON(value));
			} else if (Array.isArray(value)) {
				value.map(async (item, index) => {
					if (isMap(item)) {
						value[index] = await this.fromJSON(item);
					}
				});
			}
		});

		// Push transcluded nodes to a list to load later
		if (hypermap.attributes.has('rels') && hypermap.attributes.get('rels').includes('transclude')) {
			transcludedNodes.push(hypermap);
		}
		
		// Push script URLs to a queue to load later
		if (hypermap.attributes?.has('script')) {
			const url = new URL(hypermap.attributes.get('script'), window.location.href);
			scripts.push(url);
		}
		return hypermap;
	}

	async fetch() {
		const method = this.attributes?.get('method') || 'get';
		const url = new URL(this.attributes?.get('href'), window.location);

		if (method === 'get') {
			window.location.assign(url);
			return;
		}

		const headers = {
			'Content-Type': 'application/json'
		};

		const body = {};
		this.forEach((value, key) => {
			body[key] = value;
		});

		const options = { method, headers, body: JSON.stringify(body) };
		const response = await fetch(url, options);

		if (response.redirected) {
			window.location.assign(response.url);
		}
	}

	forEach(callbackfn) {
		this.map.forEach(callbackfn);
	}

	get(key) {
		return this.map.get(key);
	}

	deepGet(path) {
		let currentNode = this;
		path.forEach(segment => {
			// Is this valid? Can maps have numerical keys?
			const index = parseInt(segment);
			if (!Number.isNaN(index)) {
				currentNode = currentNode.at(index);
			} else {
				currentNode = currentNode.get(segment);
			}
		});
		return currentNode;
	}

	deepSet(path, value) {
		if (Array.isArray(path) && path.length > 0) {
			const key = path.pop();
			this.deepGet(path).set(key, value);
		} else {
			this.set(path, value);
		}
	}

	has(key) {
		return this.map.has(key);
	}

	set(key, value) {
		this.map.set(key, value);
		const event = new CustomEvent('changed', { detail: { key, value } });
		this.dispatchEvent(event);
		return this;
	}

	setWithoutEvent(key, val) {
		this.map.set(key, val);
	}

	keys() {
			return this.map.keys();
	}

	toDom(parentNode) {
		const hypermapNode = document.createElement('div');
		hypermapNode.className = 'hypermap';
		parentNode.appendChild(hypermapNode);

		this.forEach((value, key) => {
			if (isMap(value)) {
				console.log("Handling ", key, value, (value.constructor.name));
				value.toDom(hypermapNode);
			} else if (Array.isArray(value)) {
				console.log("Handle array…");
			} else {
				const div = document.createElement('div');
				div.id = key;
				div.className = 'foo';
				console.log(value);
				div.innerHTML = value.toString();
				hypermapNode.appendChild(div);
			}
		});
	}

	toJSON() {
		const obj = Object.fromEntries(this.map);
		if (this.attributes.size > 0) {
			obj['@'] = Object.fromEntries(this.attributes);
		}
		return obj;
	}
}

let scripts = [];
let transcludedNodes = [];

const serializedHypermap = document.body.querySelector('pre').innerHTML;
const jsonHypermap = JSON.parse(serializedHypermap);

Hypermap.fromJSON(jsonHypermap, scripts, transcludedNodes).then(hypermap => {
	globalThis.hypermap = hypermap;

	scripts.forEach(async url => {
		try {
			await import(url);
		} catch(err) {
			console.log(`Error importing script at ${url}`, err.message);
		}
	});

	transcludedNodes.forEach(async node => {
		const response = await fetch(node.attributes.get('href'));
		const json = await response.json();
		const newNode = await Hypermap.fromJSON(json, [], []);
		globalThis.hypermap = newNode;
	})

	globalThis.serializedHypermap = () => {
		return JSON.parse(JSON.stringify(globalThis.hypermap));
	};
});
