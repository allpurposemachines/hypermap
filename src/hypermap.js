const isMap = (value) => {
	return typeof value === 'object' &&
	value !== null &&
	!Array.isArray(value)
};

export class Hypermap extends EventTarget {
	attributes;
	map;
	tab;

	constructor(data, attributes) {
		super();
		this.map = new Map(data);
		this.attributes = new Map(attributes);
	}

	static fromJSON(object) {
		const entries = Object.entries(object);
		const attributes = entries.find(([key]) => key === "@")?.at(1) || {};
		const data = entries.filter(([key]) => key !== "@");

		const hypermap = new Hypermap(data, Object.entries(attributes));
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
		return hypermap;
	}

	// State changes
	fetch() {
		throw new Error('Not implemented');
	}

	// eslint-disable-next-line no-unused-vars
	deepFetch(path) {
		throw new Error('Not implemented');
	}

	// Accessors
	forEach(callbackfn) {
		this.map.forEach(callbackfn);
	}

	keys() {
		return this.map.keys();
	}

	has(key) {
		return this.map.has(key);
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

	// Modifiers
	// TODO: this only changes it client-side
	async set(key, val) {
		this.map.set(key, val);
		this.dispatchEvent(new Event('changed'));
		return this;
	}

	// setWithoutEvent(key, val) {
	// 	this.map.set(key, val);
	// 	tab?.synchronizeSate();
	// 	return this;
	// }

	// deepSet(path, value) {
	// 	if (path.length > 0) {
	// 		const key = path.pop();
	// 		this.deepGet(path).set(key, value);
	// 	}
	// 	tab?.synchronizeSate();
	// 	return this;
	// };

	// Conversions
	toJSON() {
		const obj = Object.fromEntries(this.map);
		obj['@'] = Object.fromEntries(this.attributes);
		return obj;
	}

	toString() {
		return JSON.stringify(this);
	}
}
