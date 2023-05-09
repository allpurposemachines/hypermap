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
		const proxy = new HyperProxyHandler(this.page, this);
		this.hypermap = new Proxy(unwrappedHypermap, proxy);
	}
}
