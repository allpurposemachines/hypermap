class Node extends EventTarget {
	constructor() {
		super();
		this.parent = null;
	}

	dispatchEvent(event) {
		super.dispatchEvent(event);
		if (this.parent) { // FIXME check for bubbling
			this.parent.dispatchEvent(event);
		}
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
		this.innerMap.forEach(child => child.parent = this);
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

	toJSON() {
		return Object.fromEntries(this.innerMap);
	}
}

class ListNode extends CollectionNode {
	constructor(array) {
		super();
		this.innerArray = array;
		this.innerArray.forEach(child => child.parent = this);
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

	toJSON() {
		return this.innerArray;
	}
}

class ValueNode extends Node {
	constructor(value) {
		super();
		this.value = value;
	}

	toJSON() {
		return this.value;
	}
}
class Hypermap extends MapNode {
	constructor(rootNode) {
		super(rootNode.attributes, rootNode.innerMap);
	}

	static fromJSON(json) {
		const nodeFromJsonValue = (value, allowObjects = false) => {
			// Handle existing nodes
			if (value instanceof Node) return value;

			// Handle arrays
			if (Array.isArray(value)) {
				return new ListNode(value.map(v => nodeFromJsonValue(v, allowObjects)));
			}
	
			// Handle objects
			if (value && typeof value === 'object') {
				if (!allowObjects) {
					throw new Error('Cannot convert object to node. Use a ValueNode class instead.');
				}
				const attributes = value['#'] || new MapNode();
				delete value['#'];
				return new MapNode(
					attributesFromNode(attributes),
					new Map(Object.entries(value).map(([k, v]) => [k, nodeFromJsonValue(v, true)]))
				);
			}

			// Otherwise it's a primitive value
			return new ValueNode(value);
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
				throw new Error(`Invalid attribute values: ${e.message}`);
			}
		};
	
		const reviver = (_key, value) => {
			return nodeFromJsonValue(value, true);
		};
	
		return JSON.parse(json, reviver);
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
		const node = this.nodeFromPath(path);
		node.value = value;
		const event = new CustomEvent('input', { bubbles: true, cancelable: true, detail: { target: node } });
		node.dispatchEvent(event);
		return node;
	}

	use(path) {
		const node = this.nodeFromPath(path);
		const event = new CustomEvent('use', { bubbles: true, cancelable: true, detail: { target: node }});
		node.dispatchEvent(event);
		return node;
	}

	nodeFromPath(path) {
		let pathRemaining = path;
		let currentNode = this;
		while (pathRemaining.length > 0) {
			let key = pathRemaining.shift();
			currentNode = currentNode.at(key);
		}
		return currentNode;
	}
}

export const HypermapShim = {
	Hypermap,
	MapNode,
	ListNode,
	ValueNode
}
