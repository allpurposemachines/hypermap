import test from 'node:test';
import assert from 'assert';
import { Client } from './main.js';
import mockTodoServer from './mockTodoServer.js';

const baseUrl = 'http://localhost/';
const handleRequest = mockTodoServer(baseUrl).handleRequest;

test('Create a new client and open a tab', async () => {
	const client = await Client.launch();
	const tab = await client.newTab({debug: true});
	tab.on('request', request => handleRequest(request));

	await tab.goto(baseUrl, { waitUntil: 'networkidle0' });
	assert.equal(await tab.url(), baseUrl);
	await client.close();
});

test('Load a basic HyperMap', async () => {
	const client = await Client.launch();
	const tab = await client.newTab({debug: true});
	tab.on('request', request => handleRequest(request));

	await tab.goto(baseUrl);

	assert.equal(tab.url(), baseUrl);
	const hypermap = await tab.data();

	assert.equal(hypermap.get('completed'), 0);
	assert.equal(hypermap.get('todos').length, 1);
	assert.equal(hypermap.has('newTodo'), true);

	await client.close();
});

test('Follow a link', async () => {
	const client = await Client.launch();
	const tab = await client.newTab({debug: true});
	tab.on('request', request => handleRequest(request));

	await tab.goto(baseUrl);
	await tab.fetch(['todos', 0]);
	const hypermap = await tab.data();

	assert.equal(hypermap.has('title'), true);
	assert.equal(tab.url(), 'http://localhost/1/');

	await client.close();
});

test('Use a control', async () => {
	const client = await Client.launch();
	const tab = await client.newTab({debug: true});
	tab.on('request', request => handleRequest(request));

	await tab.goto(baseUrl);
	await tab.set('title', 'Buy cheese');
	await tab.fetch(['newTodo']);

	const hypermap = await tab.data();

	assert.equal(hypermap.get('todos').length, 2);

	await client.close();
});
