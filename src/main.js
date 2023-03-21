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

		const shim = fs.readFileSync('./src/hypermapShim.js', 'utf8');
		tab.on('load', async () => {
			await tab.evaluate(shim);
		});

		tab.data = async function () {
			const hypermapJson = await this.evaluate(() => {
				return globalThis.serializedHypermap();
			});
			return Hypermap.fromJSON(hypermapJson);
		}

		tab.fetch = async function (path) {
			await Promise.all([
				this.waitForNavigation(),
				this.evaluate((path) => {
					hypermap.deepGet(path).fetch();
				}, path)
			]);
		};

		tab.set = async function (key, value) {
			this.evaluate((key, value) => {
				hypermap.set(key, value);
			});
		};

		return tab;
	}

	async tabs() {
		return await this.browser?.pages();
	}

	async close() {
		await this.browser?.close();
	}
}
