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
	constructor(attributes, map) {
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
		this.innerMap.set(key, value);
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
		this.innerArray[index] = value;
	}

	append(value) {
		this.innerArray.push(value);
	}

	prepend(value) {
		this.innerArray.unshift(value);
	}

	insert(index, value) {
		this.innerArray.splice(index, 0, value);
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

function reviver(key, value, context) {
	if (key === "#") {
		if (typeof value !== 'object') {
			throw new Error('Invalid attributes: must be a map');
		}
		try {
			let attributes = {};
			if (value.href) { attributes.href = new URL(value.href.value); }
			if (value.scripts) { attributes.scripts = value.scripts.innerArray.map((node) => new URL(node.value, window.location.origin)); }
			return attributes;
		} catch(e) {
			console.debug(e, key, value);
			throw new Error('Invalid attribute values');
		}
	};

	if (value === null) { return new NullNode; }
	else if (typeof value == "string") { return new StringNode(value); }
	else if (typeof value == "number") { return new NumberNode(value); }
	else if (typeof value == "boolean") { return new BooleanNode(value); }
	else if (Array.isArray(value)) { return new ListNode(value); }
	else if (typeof value === "object") {
		const attributes = value['#'] ?? {};
		delete value['#'];
		return new MapNode(attributes, new Map(Object.entries(value)));
	}
};

globalThis.parseHypermap = function(inputString) {
	return JSON.parse(inputString, reviver);
};
