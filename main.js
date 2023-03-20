import puppeteer from 'puppeteer';
import fs from 'fs';
import { Hypermap } from './hypermap.js';

export class Client {
	browser;

	static async launch() {
		const client = new Client();
		client.browser = await puppeteer.launch();
		return client;
	}

	async newTab(options = {}) {
		const tab = await this.browser?.newPage();

		if (options.debug) {
			await tab?.setRequestInterception(true);
			tab?.on('console', msg => console.log('PAGE LOG:', msg.text()));
		}

		const shim = fs.readFileSync('./hypermapShim.js', 'utf8');
		tab.on('load', async () => {
			await tab.evaluate(shim);
		});

		tab.data = async () => {
			const hypermapJson = await tab.evaluate(() => {
				return globalThis.serializedHypermap();
			});
			return Hypermap.fromJSON(hypermapJson);
		}

		return tab;
	}

	async tabs() {
		return await this.browser?.pages();
	}

	async close() {
		await this.browser?.close();
	}
}
