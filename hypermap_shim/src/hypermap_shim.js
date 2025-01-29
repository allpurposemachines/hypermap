class Node extends EventTarget {
	constructor() {
		super();
	}
}

class CollectionNode extends Node {
	constructor() {
		super();
	}
}

class MapNode extends CollectionNode {
	constructor(attributes = {}, map = new Map()) {
		super();
		this.attributes = attributes;
		this.innerMap = map;
	}

	async start() {
		const scripts = this.attributes.scripts || [];
		return Promise.all(scripts.map(script => {
			try {
				return import(script.href);
			} catch(err) {
				console.log(err);
			}
		}));
	}

	at(key) {
		return this.innerMap.get(key);
	}

	set(key, value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		try {
			this.innerMap.set(key, value);
			return value;
		} catch (error) {
			throw new Error(`Failed to set value for key '${key}': ${error.message}`);
		}
	}

	get size() {
		return this.innerMap.size;
	}
}

class ListNode extends CollectionNode {
	constructor(array) {
		super();
		this.innerArray = array;
	}

	at(index) {
		return this.innerArray.at(index);
	}

	set(index, value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		try {
			this.innerArray[index] = value;
			return value;
		} catch (error) {
			throw new Error(`Failed to set value at index ${index}: ${error.message}`);
		}
	}

	append(value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		try {
			this.innerArray.push(value);
			return value;
		} catch (error) {
			throw new Error(`Failed to append value: ${error.message}`);
		}
	}

	prepend(value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		try {
			this.innerArray.unshift(value);
			return value;
		} catch (error) {
			throw new Error(`Failed to prepend value: ${error.message}`);
		}
	}

	insert(index, value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		try {
			this.innerArray.splice(index, 0, value);
			return value;
		} catch (error) {
			throw new Error(`Failed to insert value at index ${index}: ${error.message}`);
		}
	}

	remove(index) {
		this.innerArray.splice(index, 1);
	}

	get size() {
		return this.innerArray.length;
	}
}

class LeafNode extends Node {
}

class BooleanNode extends LeafNode {
	constructor(value) {
		super();
		this.value = value;
	}
}

class NullNode extends LeafNode {
	constructor() {
		super();
		this.value = null;
	}
}

class NumberNode extends LeafNode {
	constructor(value) {
		super();
		this.value = value;
	}
}

class StringNode extends LeafNode {
	constructor(value) {
		super();
		this.value = value;
	}
}

globalThis.parseHypermap = function(inputString) {
	const nodeFromJsonValue = (value, allowObjects = false) => {
		// Handle existing nodes
		if (value instanceof Node) return value;
	
		// Handle primitives
		if (value === null) return new NullNode();
		if (typeof value === 'boolean') return new BooleanNode(value);
		if (typeof value === 'number') return new NumberNode(value);
		if (typeof value === 'string') return new StringNode(value);
		
		// Handle arrays
		if (Array.isArray(value)) {
			return new ListNode(value.map(v => nodeFromJsonValue(v, allowObjects)));
		}
		
		// Handle objects
		if (typeof value === 'object') {
			if (!allowObjects) {
				throw new Error('Cannot convert object to node. Use a LeafNode class instead.');
			}
			const attributes = value['#'] || new MapNode();
			delete value['#'];
			return new MapNode(
				attributesFromNode(attributes),
				new Map(Object.entries(value).map(([k, v]) => [k, nodeFromJsonValue(v, true)]))
			);
		}
		
		throw new Error('Invalid value type');
	}

	const attributesFromNode = (value) => {
		if (!(value instanceof MapNode)) {
			throw new Error('Invalid attributes: must be a simple object with valid keys');
		}
		try {
			let attributes = {};
			if (value.at('href')) {
				attributes.href = new URL(value.at('href').value);
			}
			if (value.at('scripts')) {
				attributes.scripts = value.at('scripts').innerArray.map(
					(node) => new URL(node.value, window.location.origin)
				);
			}
			return attributes;
		} catch(e) {
			throw new Error('Invalid attribute values');
		}
	};

	const reviver = (_key, value) => {
		return nodeFromJsonValue(value, true);
	};

	return JSON.parse(inputString, reviver);
};
