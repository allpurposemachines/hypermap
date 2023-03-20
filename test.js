import test from 'node:test';
import assert from 'assert';
import mockServer from 'pptr-mock-server';

import { Client } from './main.js';

const baseUrl = 'http://localhost/';
const responseConfig = {
	contentType: 'application/vnd.hypermap+json',
	body: {result: 'ok'}
};

test('Create a new client and open a tab', async () => {
	const client = await Client.launch();
	const tab = await client.newTab({debug: true});

	const mockRequest = await mockServer.default.init(tab, {
		baseApiUrl: baseUrl
	});
	mockRequest.get(baseUrl, 200, responseConfig);

	await tab.goto(baseUrl, {waitUntil: 'networkidle0'});
	assert.equal(await tab.url(), baseUrl);
	await client.close();
});

const index = {
	completed: 0,
	todos: [
		{
			'@': {
				href: '1/'
			},
			title: 'Buy milk',
			completed: false
		}
	],
	newTodo: {
		'@': {
			href: '',
			method: 'POST'
		},
		'title': 'String'
	}
};

test('Create a client and load a basic HyperMap', async () => {
	const client = await Client.launch();
	const tab = await client.newTab({debug: true});

	const mockRequest = await mockServer.default.init(tab, {
		baseApiUrl: baseUrl
	});
	const resp = responseConfig;
	resp.body = index;
	mockRequest.get(baseUrl, 200, resp);

	await tab.goto(baseUrl);

	assert.equal(tab.url(), baseUrl);
	const hypermap = await tab.data();

	assert.equal(hypermap.get('completed'), 0);
	assert.equal(hypermap.get('todos').length, 1);
	assert.equal(hypermap.has('newTodo'), true);

	await client.close();
});
