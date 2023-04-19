import Hypermap from './Hypermap.js';

export default class Tab extends EventTarget {
	page;

	constructor(page) {
		super();
		this.page = page;
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
		return Hypermap.fromJSON(hypermapJson, [], [], null, this);
	}

	async fetch(path) {
		const node = (await this.data()).at(...path);
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
