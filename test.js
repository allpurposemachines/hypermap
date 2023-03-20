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
		title: 'String'
	}
};

test('Load a basic HyperMap', async () => {
	const client = await Client.launch();
	const tab = await client.newTab({debug: true});

	const mockRequest = await mockServer.default.init(tab, {
		baseApiUrl: baseUrl
	});
	mockRequest.get(baseUrl, 200, { ...responseConfig, body: index });

	await tab.goto(baseUrl);

	assert.equal(tab.url(), baseUrl);
	const hypermap = await tab.data();

	assert.equal(hypermap.get('completed'), 0);
	assert.equal(hypermap.get('todos').length, 1);
	assert.equal(hypermap.has('newTodo'), true);

	await client.close();
});

const first = {
	title: 'Buy milk',
	completed: false
};

test('Follow a link', async () => {
	const client = await Client.launch();
	const tab = await client.newTab({debug: true});

	const mockRequest = await mockServer.default.init(tab, {
		baseApiUrl: baseUrl
	});
	mockRequest.get(baseUrl, 200, { ...responseConfig, body: index });
	mockRequest.get(baseUrl + '1/', 200, { ...responseConfig, body: first });

	await tab.goto(baseUrl);
	await tab.fetch(['todos', 0]);
	const hypermap = await tab.data();

	assert.equal(hypermap.has('title'), true);
	assert.equal(tab.url(), 'http://localhost/1/');

	await client.close();
});
