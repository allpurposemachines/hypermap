class Node extends EventTarget {
	#parent = null;

	constructor() {
		super();
	}

	get parentNode() {
		return this.#parent;
	}

	set parentNode(value) {
		// Only allow setting parentNode if it's currently null (root attachment) and value is non-Node EventTarget
		if (this.#parent === null && value && !(value instanceof Node) && value instanceof EventTarget) {
			this.#parent = value;
		} else if (this.#parent !== null || value === null) {
			throw new Error('parentNode cannot be changed after attachment');
		} else {
			throw new Error('parentNode must be an EventTarget');
		}
	}

	_setParentInternal(node) {
		if (node !== null && !(node instanceof EventTarget)) {
			throw new Error('Parent must be an EventTarget or null');
		}
		if (
			node && node instanceof Node && (node === this || this.#isAncestor(node))
		) {
			throw new Error('Cycle detected: cannot set ancestor as parent');
		}
		this.#parent = node;
	}

	#isAncestor(node) {
		let current = this.#parent;
		while (current !== null) {
			if (current === node) {
				return true;
			}
			current = current.#parent;
		}
		return false;
	}

	reparent(value) {
		// Check for cycles: is value already an ancestor of this?
		let current = this;
		while (current) {
			if (current === value) {
				throw new Error('Cycle detected: cannot set ancestor as child');
			}
			current = current.parentNode;
		}
		// Remove from old parent if it has one
		if (value.parentNode) {
			value.parentNode._detachChild(value);
		}
	}

	_attachChild(child) {
		child._setParentInternal(this);
	}

	_detachChild(child) {
		child._setParentInternal(null);
	}

	dispatchEvent(event) {
		super.dispatchEvent(event);
		if (this.#parent) {
			this.#parent.dispatchEvent(event);
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
		this.innerMap.forEach((child) => this._attachChild(child));
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
		this.reparent(value);
		this.innerMap.set(key, value);
		this._attachChild(value);
		window.dispatchEvent(new Event('mutation'));
		return this;
	}

	delete(key) {
		const child = this.innerMap.get(key);
		if (child) {
			this._detachChild(child);
		}
		this.innerMap.delete(key);
		window.dispatchEvent(new Event('mutation'));
		return this;
	}

	get size() {
		return this.innerMap.size;
	}

	toJSON() {
		let baseObject = Object.fromEntries(this.innerMap);
		if (this.attributes.href) {
			baseObject['#'] = { type: 'control' };
		}
		return baseObject;
	}
}

class ListNode extends CollectionNode {
	constructor(array) {
		super();
		this.innerArray = array;
		this.innerArray.forEach((child) => this._attachChild(child));
	}

	at(index) {
		return this.innerArray.at(index);
	}

	set(index, value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		const oldValue = this.innerArray[index];
		if (oldValue) {
			this._detachChild(oldValue);
		}
		this.innerArray[index] = value;
		this._attachChild(value);
		window.dispatchEvent(new Event('mutation'));
		return this;
	}

	append(value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		this.reparent(value);
		this.innerArray.push(value);
		this._attachChild(value);
		window.dispatchEvent(new Event('mutation'));
		return this;
	}

	prepend(value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		this.reparent(value);
		this.innerArray.unshift(value);
		this._attachChild(value);
		window.dispatchEvent(new Event('mutation'));
		return this;
	}

	insert(index, value) {
		if (!(value instanceof Node)) {
			throw new Error('Value must be a Node instance');
		}
		this.reparent(value);
		this.innerArray.splice(index, 0, value);
		this._attachChild(value);
		window.dispatchEvent(new Event('mutation'));
		return this;
	}

	delete(index) {
		const child = this.innerArray[index];
		if (child) {
			this._detachChild(child);
		}
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
				return new ListNode(
					value.map((v) => nodeFromJsonValue(v, allowObjects)),
				);
			}

			// Handle objects
			if (value && typeof value === 'object') {
				if (!allowObjects) {
					throw new Error(
					  'Cannot convert object to node. Use a ValueNode class instead.',
					);
				}
				const attributes = value['#'] || new MapNode();
				delete value['#'];
				return new MapNode(
					attributesFromNode(attributes),
					new Map(
					  Object.entries(value).map((
					    [k, v],
					  ) => [k, nodeFromJsonValue(v, true)]),
					),
				);
			}

			// Otherwise it's a primitive value
			return new ValueNode(value);
		};

		const attributesFromNode = (value) => {
			if (!(value instanceof MapNode)) {
				throw new Error(
					'Invalid attributes: must be a simple object with valid keys',
				);
			}
			try {
				let attributes = {};
				if (value.at('href')) {
					attributes.href = value.at('href').value;
				}
				if (value.at('method')) {
					attributes.method = value.at('method').value;
				}
				if (value.at('scripts')) {
					attributes.scripts = value.at('scripts').innerArray.map(
					  (node) => node.value,
					);
				}
				return attributes;
			} catch (e) {
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
		return Promise.all(scripts.map((script) => {
			try {
				const absoluteUrl = new URL(script, window.location.href);
				return import(absoluteUrl);
			} catch (err) {
				console.log(err);
			}
		}));
	}

	input(path, value) {
		const node = this.nodeFromPath(path);
		node.value = value;
		const event = new CustomEvent('input', {
			bubbles: true,
			cancelable: true,
			detail: { target: node },
		});
		node.dispatchEvent(event);
		return node;
	}

	use(path) {
		const node = this.nodeFromPath(path);
		const event = new CustomEvent('use', {
			bubbles: true,
			cancelable: true,
			detail: { target: node },
		});
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
	ValueNode,
};
