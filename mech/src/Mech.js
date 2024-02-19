import puppeteer from 'puppeteer';
import { Tab } from './Tab.js';
import esbuild from 'esbuild';

const Mech = {
	debug: false,
	/** @type { (function(puppeteer.HTTPRequest): void) | null } */
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

		const bundledShim = esbuild.buildSync({
			entryPoints: ['node_modules/@allpurposemachines/hypermap-shim/src/index.js'],
			bundle: true,
			write: false,
			platform: 'browser',
			format: 'esm'
		});

		page.on('domcontentloaded', async () => {
			await page.evaluate(bundledShim.outputFiles[0].text);
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
