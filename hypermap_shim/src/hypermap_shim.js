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

	has(key) {
		return this.innerMap.has(key);
	}

	at(key) {
		return this.innerMap.get(key);
	}

	set(key, value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		this.innerMap.set(key, value);
		window.dispatchEvent(new Event('mutation'));
		return this;
	}

	delete(key) {
		this.innerMap.delete(key);
		window.dispatchEvent(new Event('mutation'));
		return this;
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
		this.innerArray[index] = value;
		window.dispatchEvent(new Event('mutation'));
		return this;
	}

	append(value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		this.innerArray.push(value);
		window.dispatchEvent(new Event('mutation'));
		return this;
	}

	prepend(value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		this.innerArray.unshift(value);
		window.dispatchEvent(new Event('mutation'));
		return this;
	}

	insert(index, value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		this.innerArray.splice(index, 0, value);
		window.dispatchEvent(new Event('mutation'));
		return this;
	}

	delete(index) {
		this.innerArray.splice(index, 1);
		window.dispatchEvent(new Event('mutation'));
		return this;
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

class Hypermap extends MapNode {
	constructor(rootNode) {
		super(rootNode.attributes, rootNode.innerMap);
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

	input(path, value) {
		let pathRemaining = path;
		let currentNode = this;
		while (pathRemaining.length > 0) {
			let key = pathRemaining.shift();
			currentNode = currentNode.at(key);
		}
		currentNode.value = value;
		currentNode.dispatchEvent(new Event('input'));
		return currentNode;
	}
}

globalThis.setHypermap = function(mapNode) {
	globalThis.hypermap = new Hypermap(mapNode);
	return globalThis.hypermap.start();
};
