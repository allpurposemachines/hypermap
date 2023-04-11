import test from 'node:test';
import assert from 'assert';
import { Client } from '../src/main.js';
import mockTodoServer from './mockTodoServer.js';

const baseUrl = 'http://localhost/';
const mockServer = mockTodoServer(baseUrl);
const handleRequest = mockServer.handleRequest;

test('Given a client with a tab', async (t) => {
	const client = await Client.launch();
	const tab = await client.newTab({debug: true});
	tab.on('request', request => handleRequest(request));

	t.afterEach(() => mockServer.reset());

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
		const newTitle = 'Buy cheese';
		await tab.set(['newTodo', 'title'], newTitle);
		await tab.fetch(['newTodo']);
		
		const hypermap = await tab.data();
		assert.equal(hypermap.get('todos').length, 2);
		assert.equal(hypermap.deepGet(['todos', 1, 'title']), newTitle);
	});
	
	await t.test('Load a script', async () => {
		await tab.goto(baseUrl + 'scriptTest/', { waitUntil: 'networkidle0' });
		
		const hypermap = await tab.data();
		assert.equal(hypermap.get('foo'), 'bar');
	});

	await t.test('Handle an event (script to script)', async () => {
		await tab.goto(baseUrl + 'scriptTest/', { waitUntil: 'networkidle0' });
		await tab.set('input', 'test');

		const hypermap = await tab.data();
		assert.equal(hypermap.get('output'), 1);
	});

	await t.test('Load a document with transclusions', async () => {
		await tab.goto(baseUrl + 'transclude/', { waitUntil: 'networkidle0'});

		const hypermap = await tab.data();
		assert.equal(hypermap.deepGet(['todos', 'completed']), 0);
	});

	await t.test('Fetching a transcluded node', async () => {
		await tab.goto(baseUrl + 'transclude/', { waitUntil: 'networkidle0'});
		let hypermap = await tab.data();
		assert.equal(hypermap.deepGet(['counter', 'count']), 0);

		await tab.fetch(['counter']);
		hypermap = await tab.data();
		assert.equal(hypermap.deepGet(['counter', 'count']), 1);
	});

	await client.close();
});
