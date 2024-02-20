import puppeteer from 'puppeteer';
import { Tab } from './Tab.js';
import fs from 'node:fs';

const Mech = {
	debug: false,
	/** @type { (function(puppeteer.HTTPRequest): void) | null } */
	debugRequestHandler: null,
	/** @type { puppeteer.Browser | null } */
	browser: null,
	pathToShim: './dist/shim.js',

	/** @param { string } url */
	async open(url) {
		if (!this.browser) {
			this.browser = await puppeteer.launch({
				timeout: 0
			});
		}

		const page = await this.browser.newPage();
		
		if (this.debug) {
			await page.setRequestInterception(true);
			page.on('console', msg => console.log('PAGE LOG:', msg.text()));
			if (this.debugRequestHandler) {
				page.on('request', this.debugRequestHandler);
			}
		}

		await page.exposeFunction('contentChanged', () => {
			page.emit('contentchanged', null);
		});

		const bundledShim = fs.readFileSync(this.pathToShim, 'utf8');

		page.on('domcontentloaded', async () => {
			await page.evaluate(bundledShim);
		});

		const tab = new Tab(page);
		await tab.open(url);
		return tab;
	},

	async tabs() {
		return await this.browser?.pages();
	},

	async close() {
		await this.browser?.close();
	}
}

export { Mech, Tab };
