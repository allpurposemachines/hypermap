import { isMap } from './utils/json_processing.js';

export default class Hypermap extends EventTarget {
	attributes;
	map;

	constructor(data, attributes) {
		super();
		this.map = new Map(Object.entries(data));
		this.attributes = attributes;
	}

	static fromJSON(object, scripts = [], transcludedNodes = []) {
		const attributes = object['@'] || {};
		delete object['@'];

		let hypermap = new this(object, attributes);
		hypermap.forEach((value, key) => {
			if (isMap(value)) {
				hypermap.set(key, this.fromJSON(value, scripts, transcludedNodes));
			} else if (Array.isArray(value)) {
				value.map((item, index) => {
					if (isMap(item)) {
						value[index] = this.fromJSON(item, scripts, transcludedNodes);
					}
				});
			}
		});

		// Push transcluded nodes to a list to load later
		if (attributes.rels?.includes('transclude')) {
			transcludedNodes.push(hypermap);
		}
		
		// Push script URLs to a queue to load later
		if (attributes.script && typeof window !== 'undefined') {
			const url = new URL(attributes.script, window.location.href);
			scripts.push(url);
		}
		return hypermap;
	}

	// Todo: make isomorphic
	async fetch() {
		const method = this.attributes.method || 'get';
		const url = new URL(this.attributes.href, window.location);

		if (method === 'get') {
			if (this.attributes.rels?.includes('transclude')) {
				await this.fetchTransclusion();
			} else {
				window.location.assign(url);
			}
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

	// Todo: this should forward to tab when running as client
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

	// Todo: this should forward to tab when running as client
	set(key, value) {
		this.map.set(key, value);
		if (typeof CustomEvent !== 'undefined') {
			const event = new CustomEvent('changed', { detail: { key, value } });
			this.dispatchEvent(event);
		}
		if (typeof window !== 'undefined') {
			window.contentChanged();
		}
		return this;
	}

	keys() {
			return this.map.keys();
	}

	replace(otherHypermap) {
		this.map = otherHypermap.map;
		return this;
	}

	// Todo: make isomorphic
	async fetchTransclusion() {
		const response = await fetch(this.attributes.href);
		const json = await response.json();
		// Todo: should handle scripts and sub-transclusions
		const newNode = await Hypermap.fromJSON(json, [], []);
		this.replace(newNode);
	}

	toJSON() {
		const obj = Object.fromEntries(this.map);
		if (Object.entries(this.attributes).length > 0) {
			obj['@'] = this.attributes;
		}
		return obj;
	}

	toString() {
		JSON.stringify(this.toJSON(), null, 2);
	}
}
