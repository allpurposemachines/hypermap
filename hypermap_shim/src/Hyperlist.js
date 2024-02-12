import Hypermap from './Hypermap.js';
import { isMap } from './utils.js';

export default class Hyperlist extends EventTarget {
	array;
	#parent;

	/**
	 * @param { import('./Hypermap.js').Value[] } array 
	 * @param { import('./Hypermap.js').Node } parent 
	 */
	constructor(array, parent) {
		super();
		this.array = array;
		this.#parent = parent;
	}

	/** @param { unknown } value */
	static isHyperlist(value) {
		return value instanceof Hyperlist;
	}

	/**
	 * @param { unknown[] } array
	 * @param { import('./Hypermap.js').Node } parent
	 */
	static fromLiteral(array, parent) {
		const hyperlist = new this([], parent);
		/** @type { import('./Hypermap.js').Value[] } */
		const convertedArray = array.map(value => {
			if (isMap(value)) {
				const hypermapLiteral = /** @type { import('./Hypermap.js').HypermapLiteral } */(value);
				return Hypermap.fromLiteral(hypermapLiteral, hyperlist);
			} else if (Array.isArray(value)) {
				return this.fromLiteral(value, hyperlist);
			} else {
				const valueLiteral = /** @type { import('./Hypermap.js').ValueLiteral} */(value);
				return valueLiteral;
			}
		});
		hyperlist.array = convertedArray;
		return hyperlist;
	}

	async hydrate() {
		this.children().forEach(child => {
			child.hydrate();
		})
	}

	/**
	 * @param { (string|number)[] } path
	 * @returns { import('./Hypermap.js').Value | undefined }
	 */
	at(...path) {
		if (path.length === 0) {
			return this;
		}
		
		/** @type { import('./Hypermap.js').Value | undefined } */
		const head = this.array.at(/** @type { number } */(path.at(0)));
		if (head === undefined || (path.length > 1 && !(Hyperlist.isHyperlist(head) || Hypermap.isHypermap(head)))) {
			return undefined;
		}
		
		if (path.length === 1) {
			return head;
		} else {
			const node = /** @type { import('./Hypermap.js').Node } */(head);
			return node.at(...path.slice(1));
		}
	}

	/** @param { (value: import('./Hypermap.js').Value, index: number) => void } callback */
	forEach(callback) {
		this.array.forEach(callback);
	}

	length() {
		return this.array.length;
	}

	/** @param { import('./Hypermap.js').Value } value */
	prepend(value) {
		this.array.unshift(value);
	}

	/** @param { import('./Hypermap.js').Value } value */
	append(value) {
		this.array.push(value);
	}

	/**
	 * @param { number } index
	 * @param { import('./Hypermap.js').Value } value
	 * */
	set(index, value) {
		this.array[index] = value;
	}

	/**
	 * @param { number } index
	 * @param { import('./Hypermap.js').Value } value
	 * */	
	insert(index, value) {
		this.array.splice(index, 0, value);
	}

	/**
	 * @param { number } index
	 * */
	delete(index) {
		this.array.splice(index, 1);
	}

	parent() {
		return this.#parent;
	}

	/** @returns { import('./Hypermap.js').Node[] } */
	children() {
		const nodeArray = this.array
			.filter(value => Hyperlist.isHyperlist(value) || Hypermap.isHypermap(value));
		return /** @type { import('./Hypermap.js').Node[] } */(nodeArray);
	}

	/** @returns { (string|number)[] } */
	path() {
		if (this.parent() === null) {
			return [];
		} else {
			const key = /** @type { number } */ (this.parent().keyFor(this));
			return this.parent().path().concat(key);
		}
	}

	/**
	 * @param { string } key 
	 * @param { unknown } values 
	 */
	async $(key, values) {
		const unknownVal = this.at(key);

		if (!Hypermap.isHypermap(unknownVal)) {
			return;
		}

		const hypermap = /** @type { Hypermap } */(unknownVal);

		if (values) {
			Object.entries(values).forEach(([key, value]) => {
				hypermap.set(key, value);
			});
		}
		await hypermap.fetch();
	}

	/** @param { import('./Hypermap.js').Node } node */
	keyFor(node) {
		return this.array.indexOf(node);
	}

	toJSON() {
		return this.array;
	}
}
