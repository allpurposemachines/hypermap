import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { Tab } from './Tab.js';

const Mech = {
	debug: false,
	debugRequestHandler: null,
	/** @type { puppeteer.Browser | null } */
	browser: null,

	/** @param { string } url */
	async open(url) {
		if (!this.browser) {
			this.browser = await puppeteer.launch();
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
			page.emit('contentchanged');
		});

		const shim = fs.readFileSync(new URL('assets/shim.js', import.meta.url), 'utf8');
		page.on('load', async () => {
			await page.evaluate(shim);
		});

		const tab = new Tab(page);
		await tab.open(url); //), { waitUntil: 'networkidle0' });
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
