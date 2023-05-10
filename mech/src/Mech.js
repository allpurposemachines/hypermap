import puppeteer from 'puppeteer';
import * as fs from 'fs';
import Tab from './Tab.js';

export class Mech {
	#browser;

	static async launch() {
		const mech = new Mech();
		mech.#browser = await puppeteer.launch();
		return mech;
	}

	async newTab(options = {}) {
		const page = await this.#browser?.newPage();

		if (options.debug) {
			await page.setRequestInterception(true);
			page.on('console', msg => console.log('PAGE LOG:', msg.text()));
		}

		await page.exposeFunction('contentChanged', () => {
			page.emit('contentchanged');
		});

		const shim = fs.readFileSync(new URL('assets/shim.js', import.meta.url), 'utf8');
		page.on('load', async () => {
			await page.evaluate(shim);
		});

		return new Tab(page, options);
	}

	async tabs() {
		return await this.#browser?.pages();
	}

	async close() {
		await this.#browser?.close();
	}
}
