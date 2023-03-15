import puppeteer from 'puppeteer';

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
