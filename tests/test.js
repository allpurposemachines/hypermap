import test from 'node:test';
import assert from 'assert';
import { Client } from '../src/main.js';
import mockTodoServer from './mockTodoServer.js';

const baseUrl = 'http://localhost/';
const handleRequest = mockTodoServer(baseUrl).handleRequest;

test('Given a client with a tab', async (t) => {
	const client = await Client.launch();
	const tab = await client.newTab({debug: true});
	tab.on('request', request => handleRequest(request));

	await t.test('Direct navigation', async () => {
		await tab.goto(baseUrl, { waitUntil: 'networkidle0' });
		
		assert.equal(await tab.url(), baseUrl);
	});
	
	await t.test('Load a basic HyperMap', async () => {
		await tab.goto(baseUrl);

		const hypermap = await tab.data();
		assert.equal(hypermap.get('completed'), 0);
		assert.equal(hypermap.get('todos').length, 1);
		assert.equal(hypermap.has('newTodo'), true);
	});
	
	await t.test('Follow a link', async () => {	
		await tab.goto(baseUrl);
		await tab.fetch(['todos', 0]);
		
		const hypermap = await tab.data();
		assert.equal(hypermap.has('title'), true);
		assert.equal(tab.url(), 'http://localhost/1/');
	});
	
	await t.test('Use a control', async () => {	
		await tab.goto(baseUrl);
		await tab.set('title', 'Buy cheese');
		await tab.fetch(['newTodo']);
		
		const hypermap = await tab.data();
		assert.equal(hypermap.get('todos').length, 2);
	});
	
	await t.test('Script loading', async () => {
		await tab.goto(baseUrl + 'scriptTest/', { waitUntil: 'networkidle0' });
		
		const hypermap = await tab.data();
		assert.equal(hypermap.get('Foo'), 'Bar');
	});

	await client.close();
});
