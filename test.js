import test from 'node:test';
import assert from 'assert';
import mockServer from 'pptr-mock-server';

import { Client } from './main.js';

test('creating and launching a new Client', async () => {
	const client = await Client.launch();
	const tab = await client.newTab({debug: true});

	const baseUrl = 'http://localhost/';
	const mockRequest = await mockServer.default.init(tab, {
		baseApiUrl: baseUrl
	});
	const responseConfig = {body: {result: 'ok'}};
	mockRequest.get(baseUrl, 200, responseConfig);

	await tab.goto(baseUrl);
	assert.equal(tab.url(), baseUrl);
	await client.close();
});
