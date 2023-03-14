import test from 'node:test';
import assert from 'assert';
import puppeteer from 'puppeteer';

// import { Client } from 'main';

test('creating and launching a new Client', async () => {
	const b = await puppeteer.launch();
	const tab = await b.newPage();
	const testUrl = 'https://www.google.com/';
	await tab.goto(testUrl);

	assert.equal(tab.url(), testUrl);

	await b.close();

	// const client = new Client();
	// await client.launch();
	// const tab = client.newTab();
	// const testUrl = 'http://localhost/';
	// await tab.goto(testUrl);
	// expect(tab.url()).toBe(testUrl);
});
