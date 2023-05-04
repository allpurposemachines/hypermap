import { EventEmitter } from 'node:events';
import Hypermap from './Hypermap.js';
// import { CustomEvent } from 'node:events';

export default class Tab extends EventEmitter {
	page;

	constructor(page) {
		super();
		this.page = page;

		this.page.on('contentchanged', () => {
			this.emit('contentchanged');
		});

		this.page.on('console', msg => {
			this.emit('console', msg);
		});
	}

	async goto(...args) {
		await this.page.goto(...args);
	}

	url() {
		return this.page.url();
	}

	async data() {
		const hypermapJson = await this.page.evaluate(() => {
			return globalThis.serializedHypermap();
		});
		return Hypermap.fromLiteral(hypermapJson);
	}

	async fetch(path) {
		const node = (await this.data()).at(...path);

		if (node == undefined) {
			throw new Error('Node does not exist');
		}

		if (node.attributes === undefined) {
			throw new Error('Attempting to fetch a non-fetchable node');
		}

		if (node.attributes.rels?.includes('transclude')) {
			await this.page.evaluate(async path => {
				await globalThis.hypermap.at(...path).fetch();
			}, path);
		} else {
			await Promise.all([
				this.page.waitForNavigation(),
				this.page.evaluate(path => {
					globalThis.hypermap.at(...path).fetch();
				}, path)
			]);
		}
	}

	async set(path, value) {
		await this.page.evaluate((path, value) => {
			globalThis.hypermap.at(...path.slice(0, -1)).set(path.at(-1), value);
		}, path, value);
	}
}
