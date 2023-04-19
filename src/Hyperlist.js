import Hypermap from './Hypermap.js';
import { isMap } from './utils/json_processing.js';

export default class Hyperlist extends EventTarget {
	array;
	#parent;

	constructor(array, parent) {
		super();
		this.array = array;
		this.#parent = parent;
	}

	static fromLiteral(array, parent) {
		const hyperlist = new this([], parent);
		const convertedArray = array.map(value => {
			if (isMap(value)) {
				return Hypermap.fromLiteral(value, hyperlist);
			} else if (Array.isArray(value)) {
				return Hyperlist.fromLiteral(value, hyperlist);
			} else {
				return value;
			}
		});
		hyperlist.array = convertedArray;
		return hyperlist;
	}

	at(...path) {
		if (path.length === 0) {
			return this;
		}
		
		const head = this.array.at(path.at(0));
		if (head === undefined || (path.length > 1 && typeof head.at !== 'function')) {
			return undefined;
		}
		
		if (path.length === 1) {
			return head;
		} else {
			return head.at(...path.slice(1));
		}
	}

	length() {
		return this.array.length;
	}

	toJSON() {
		return this.array;
	}
}
