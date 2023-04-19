import { isMap } from './utils/json_processing.js';
import Hyperlist from './Hyperlist.js';

export default class Hypermap extends EventTarget {
	attributes;
	map;
	#parent;

	constructor(data, attributes, parent) {
		super();
		this.map = new Map(Object.entries(data));
		this.attributes = attributes;
		this.#parent = parent;
	}

	static fromLiteral(object, parent = null) {
		const attributes = object['@'] || {};
		delete object['@'];

		let hypermap = new this(object, attributes, parent);
		hypermap.forEach((value, key) => {
			if (isMap(value)) {
				hypermap.map.set(key, this.fromLiteral(value, hypermap));
			} else if (Array.isArray(value)) {
				hypermap.map.set(key, Hyperlist.fromLiteral(value, hypermap));
			}
		});
		return hypermap;
	}

	static isCollection(value) {
		return ['Hypermap', 'Hyperlist'].includes(value.constructor.name);
	}

	async hydrate() {
		if (this.attributes.script) {
			try {
				await import(this.attributes.script);
			} catch(err) {
				console.log(`Error importing script at ${this.attributes.script}`, err.message);
			}
		}
	
		if (this.attributes.rels?.includes('transclude')) {
			this.fetchTransclusion();
		}

		this.children().forEach(child => {
			child.hydrate();
		})
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

	at(...path) {
		if (path.length === 0) {
			return this;
		}
		
		const head = this.map.get(path.at(0));
		if (head === undefined || (path.length > 1 && typeof head.at !== 'function')) {
			return undefined;
		}
		
		if (path.length === 1) {
			return head;
		} else {
			return head.at(...path.slice(1));
		}
	}

	parent() {
		this.parent;
	}

	children() {
		return [...this.map]
			.filter(([_, value]) => Hypermap.isCollection(value))
			.map(([_, value]) => value);
	}
	
	path() {
		if (this.#parent === null) {
			return [];
		} else {
			return this.#parent.path().concat(this.#parent.keyFor(this));
		}
	}

	keyFor(node) {
		for (const [key, value] of this.map) {
			if (value === node) {
				return key;
			}
		}

		return undefined;
	}

	has(key) {
		return this.map.has(key);
	}

	set(key, value) {
		this.map.set(key, value);
		const event = new CustomEvent('changed', { detail: { key, value } });
		this.dispatchEvent(event);
		window.contentChanged();
		return this;
	}

	keys() {
		return this.map.keys();
	}

	replace(otherHypermap) {
		this.map = otherHypermap.map;
		return this;
	}

	length() {
		throw new Error('DRAGONS');
	}

	async fetchTransclusion() {
		const response = await fetch(this.attributes.href);
		const json = await response.json();
		// Todo: should handle scripts and sub-transclusions
		const newNode = Hypermap.fromLiteral(json);
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
		return JSON.stringify(this, null, 2);
	}
}
