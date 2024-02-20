import { EventEmitter } from 'node:events';
import { Hypermap } from '@allpurposemachines/hypermap-shim';
import HyperProxyHandler from './HyperProxyHandler.js';

export class Tab extends EventEmitter {
	/** @type { import('puppeteer').Page } */
	page;
	/** @type { Hypermap | null } */
	hypermap = null;

	/** @param { import('puppeteer').Page } page */
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

	/**
	 * @param { string } url
	 * @param { import('puppeteer').WaitForOptions= } options
	*/
	async open(url, options = { waitUntil: 'networkidle0' }) {
		await this.page.goto(url, options);
		await this.syncData();
	}

	async close() {
		await this.page.close();
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
