import { isMap } from './utils.js';
import Hyperlist from './Hyperlist.js';

/** @typedef { {href?: string, method?: string, rels?: string[], script?: string} } Attributes */
/** @typedef { null | boolean | number | string } ValueLiteral */
/** @typedef { Record<string, unknown> } HypermapLiteral */
/** @typedef { unknown[] } HyperlistLiteral */
/** @typedef { Hypermap | Hyperlist } Node */
/** @typedef { Node | ValueLiteral } Value */

export default class Hypermap extends EventTarget {
	/** @type { Attributes } */
	attributes;
	map;
	/** @type { Node | null } */
	#parent;

	/**
	 * @param { object } data
	 * @param { Attributes } attributes
	 * @param { Node | null } parent
	 */
	constructor(data, attributes, parent) {
		super();
		this.map = new Map(Object.entries(data));
		this.attributes = attributes;
		this.#parent = parent;
	}

	/** @param { unknown } value */
	static isHypermap(value) {
		return value instanceof Hypermap;
	}

	/**
	 * @param { HypermapLiteral } object
	 * @param { Node | null } parent
	 */
	static fromLiteral(object, parent = null) {
		/** @type { Attributes } */
		const attributes = object['@'] ?? {};
		delete object['@'];

		let hypermap = new this(object, attributes, parent);
		hypermap.forEach(
			/**
			 * @param { string } key
			 * @param { unknown } value
			*/
			(value, key) => {
				if (isMap(value)) {
					const hypermapLiteral = /** @type { HypermapLiteral } */ (value);
					hypermap.map.set(key, this.fromLiteral(hypermapLiteral, hypermap));
				} else if (Array.isArray(value)) {
					const hyperlistLiteral = /** @type { HyperlistLiteral } */ (value);
					hypermap.map.set(key, Hyperlist.fromLiteral(hyperlistLiteral, hypermap));
				}
			}
		);
		return hypermap;
	}

	async hydrate() {
		if (this.attributes.script) {
			try {
				await import(this.attributes.script);
			} catch(err) {
				// @ts-expect-error: err is fine
				console.log(`Error importing script at ${this.attributes.script}`, err.message);
			}
		}
	
		if (this.attributes.rels?.includes('transclude')) {
			await this.fetchTransclusion();
		}

		this.children().forEach(child => {
			child.hydrate();
		})
	}

	async fetch() {
		if (this.attributes.href === null || this.attributes.href === undefined) {
			return Promise.reject('No href');
		}

		const method = this.attributes.method || 'get';
		const url = new URL(this.attributes.href, window.location.href);

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

		/** @type { Record<string, Value> } */
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

	/**
	 * @param { string } key
	 * @param { Record<string, Value>= } values
	*/
	async $(key, values) {
		const node = this.at(key);
		if (values) {
			Object.entries(values).forEach(([key, value]) => {
				node.set(key, value);
			});
		}
		await node.fetch();
	}

	/** @param { (value: Value, key: string) => void } callback */
	forEach(callback) {
		this.map.forEach(callback);
	}

	/** @param { (string|number)[] } path */
	at(...path) {
		if (path.length === 0) {
			return this;
		}
		
		// @ts-expect-error
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
		return this.#parent;
	}

	/** @returns { Node[] } */
	children() {
		return [...this.map.values()]
			.filter(value => value.isCollection && value.isCollection());
	}
	
	/** @returns { (string|number)[] } */
	path() {
		if (this.parent() === null) {
			return [];
		} else {
			const parent = /** @type { Node } */(this.parent());
			const key = /** @type { string } */(parent.keyFor(this));
			return parent.path().concat(key);
		}
	}

	/** @param { Hypermap | Hyperlist } node */
	keyFor(node) {
		for (const [key, value] of this.map) {
			if (value === node) {
				return key;
			}
		}

		return undefined;
	}

	/** @param { string } key */
	has(key) {
		return this.map.has(key);
	}

	/**
	 * @param { string } key
	 * @param { Value } value
	 */
	set(key, value) {
		this.map.set(key, value);
		if (window) {
			const event = new CustomEvent('changed', { detail: { key, value } });
			this.dispatchEvent(event);
			// @ts-expect-error
			window.contentChanged();
		}
		return this;
	}

	/** @param { string } key */
	delete(key) {
		this.map.delete(key);
	}

	keys() {
		return this.map.keys();
	}

	/** @param { Hypermap } otherHypermap */
	replace(otherHypermap) {
		this.map = otherHypermap.map;
		return this;
	}

	length() {
		return [...this.map.values()].length;
	}

	isCollection() {
		return true;
	}

	async fetchTransclusion() {
		if (this.attributes.href) {
			const response = await fetch(this.attributes.href);
			const json = await response.json();
			// Todo: should handle scripts and sub-transclusions
			// @ts-expect-error
			const newNode = this.constructor.fromLiteral(json);
			this.replace(newNode);
		}
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
