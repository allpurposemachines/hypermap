import puppeteer from 'puppeteer';
import * as fs from 'fs';
import Hypermap from './Hypermap.js';

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

		await tab.exposeFunction('contentChanged', () => {
			tab.emit('contentchanged');
		});

		const shim = fs.readFileSync(new URL('assets/shim.js', import.meta.url), 'utf8');
		tab.on('load', async () => {
			await tab.evaluate(shim);
		});

		tab.data = async function () {
			const hypermapJson = await this.evaluate(() => {
				return globalThis.serializedHypermap();
			});
			return Hypermap.fromJSON(hypermapJson, [], [], null, this);
		}

		tab.fetch = async function (path) {
			const node = (await this.data()).at(...path);
			if (node.attributes.rels?.includes('transclude')) {
				await this.evaluate(async path => {
					// eslint-disable-next-line no-undef
					await hypermap.at(...path).fetch();
				}, path);
			} else {
				await Promise.all([
					this.waitForNavigation(),
					this.evaluate(path => {
						// eslint-disable-next-line no-undef
						hypermap.at(...path).fetch();
					}, path)
				]);
			}
		};

		tab.set = async function(path, value) {
			await this.evaluate((path, value) => {
				globalThis.hypermap.at(...path.slice(0, -1)).set(path.at(-1), value);
			}, path, value);
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
