import { EventEmitter } from 'node:events';
import Hypermap from './Hypermap.js';
import HyperProxyHandler from './HyperProxyHandler.js';

export default class Tab extends EventEmitter {
	/** @type { import('puppeteer').Page } */
	page;
	/** @type { Hypermap | null } */
	hypermap = null;

	/** @param { import('puppeteer').Page } page */
	constructor(page) {
		super();
		this.page = page;

		// @ts-expect-error
		this.page.on('contentchanged', async () => {
			await this.syncData();
			this.emit('contentchanged');
		});

		this.page.on('console', msg => {
			this.emit('console', msg);
		});
	}

	/**
	 * @param { string } url
	 * @param { import('puppeteer').WaitForOptions= } options
	*/
	async goto(url, options = {}) {
		await this.page.goto(url, options);
		await this.syncData();
	}

	url() {
		return this.page.url();
	}

	async syncData() {
		const hypermapJson = await this.page.evaluate(() => {
			// @ts-expect-error
			return globalThis.serializedHypermap();
		});
		const unwrappedHypermap = Hypermap.fromLiteral(hypermapJson);
		const proxy = new HyperProxyHandler(this.page, this);
		this.hypermap = /** @type { Hypermap } */ (new Proxy(unwrappedHypermap, proxy));
	}
}
