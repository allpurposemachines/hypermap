const isMap = (value) => {
	return typeof value === 'object' &&
	value !== null &&
	!Array.isArray(value)
};

export class Hypermap extends EventTarget {
	attributes;
	map;

	constructor(data, attributes) {
		super();
		this.map = new Map(data);
		this.attributes = new Map(attributes);
	}

	static fromJSON(object) {
		const entries = Object.entries(object);
		const attributes = entries.find(([key, _value]) => key === "@")?.at(1) || {};
		const data = entries.filter(([key, _value]) => key !== "@");

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
	};

	deepSet(path, value) {
		if (path.length > 0) {
			const key = path.pop();
			this.deepGet(path).set(key, value);
		}
	};

	has(key) {
		return this.map.has(key);
	}

	set(key, val) {
		this.map.set(key, val);
		this.dispatchEvent(new Event('changed'));
		return this;
	}

	setWithoutEvent(key, val) {
		this.map.set(key, val);
	}

	keys() {
			return this.map.keys();
	}

	toJSON() {
		const obj = Object.fromEntries(this.map);
		obj['@'] = Object.fromEntries(this.attributes);
		return obj;
	}

	toString() {
		return JSON.stringify(this);
	}
}
