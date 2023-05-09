import { EventEmitter } from 'node:events';
import Hypermap from './Hypermap.js';
import HyperProxyHandler from './HyperProxyHandler.js';

export default class Tab extends EventEmitter {
	page;
	hypermap = null;

	constructor(page) {
		super();
		this.page = page;

		this.page.on('contentchanged', async () => {
			await this.syncData();
			this.emit('contentchanged');
		});

		this.page.on('console', msg => {
			this.emit('console', msg);
		});
	}

	async goto(...args) {
		await this.page.goto(...args);
		await this.syncData();
	}

	url() {
		return this.page.url();
	}

	async syncData() {
		const hypermapJson = await this.page.evaluate(() => {
			return globalThis.serializedHypermap();
		});
		const unwrappedHypermap = Hypermap.fromLiteral(hypermapJson);
		// this.hypermap = unwrappedHypermap;
		// const proxy = {
		// 	get(target, prop) {
		// 		console.log('OUTER', target, prop);
		// 		Reflect.get(...arguments);
		// 	}
		// };
		const proxy = new HyperProxyHandler(this.page, this);
		this.hypermap = new Proxy(unwrappedHypermap, proxy);
	}

	// async $(key) {
	// 	const node = (await this.data()).at(...path);

	// 	if (node == undefined) {
	// 		throw new Error('Node does not exist');
	// 	}

	// 	if (node.attributes === undefined) {
	// 		throw new Error('Attempting to fetch a non-fetchable node');
	// 	}

	// 	if (node.attributes.rels?.includes('transclude')) {
	// 		await this.page.evaluate(async path => {
	// 			await globalThis.hypermap.at(...path).fetch();
	// 		}, path);
	// 	} else {
	// 		await Promise.all([
	// 			this.page.waitForNavigation(),
	// 			this.page.evaluate(path => {
	// 				globalThis.hypermap.at(...path).fetch();
	// 			}, path)
	// 		]);
	// 	}

	// 	await this.syncData();
	// }

	// async set(path, value) {
	// 	await this.page.evaluate((path, value) => {
	// 		globalThis.hypermap.at(...path.slice(0, -1)).set(path.at(-1), value);
	// 	}, path, value);
	// }
}
