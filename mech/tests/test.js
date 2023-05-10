import test from 'node:test';
import assert from 'assert';
import Mech from '../wrapper.js';
import mockTodoServer from './mockTodoServer.js';

const baseUrl = 'http://localhost/';
const mockServer = mockTodoServer(baseUrl);
const handleRequest = mockServer.handleRequest;

test('Given a tab', async (t) => {
	const mech = await Mech.launch();
	const tab = await mech.newTab({debug: true});
	tab.page.on('request', request => handleRequest(request));

	t.afterEach(() => mockServer.reset());

	await t.test('Direct navigation', async () => {
		await tab.goto(baseUrl, { waitUntil: 'networkidle0' });
		
		assert.strictEqual(await tab.url(), baseUrl);
	});
	
	await t.test('Load a basic HyperMap', async () => {
		await tab.goto(baseUrl);

		assert.strictEqual(tab.hypermap.at('completed'), 0);
		assert.strictEqual(tab.hypermap.at('todos').length(), 1);
		assert.strictEqual(tab.hypermap.has('newTodo'), true);
		assert.strictEqual(tab.hypermap.at('completed', 'badPath'), undefined);
	});

	await t.test('Navigate the hierarchy', async () => {
		await tab.goto(baseUrl + 'deep/');

		assert.deepStrictEqual(tab.hypermap.path(), []);
		assert.deepStrictEqual(tab.hypermap.at('one', 'two', 'three').path(), ['one', 'two', 'three']);

		assert.strictEqual(tab.hypermap.children().length, 1);
		assert.strictEqual(tab.hypermap.parent(), null);
		assert.deepStrictEqual(tab.hypermap.at('one').parent(), tab.hypermap);
	});
	
	await t.test('Follow a link', async () => {
		await tab.goto(baseUrl);
		await tab.hypermap.at('todos').$(0);
		
		await tab.syncData();
		assert.strictEqual(tab.hypermap.has('title'), true);
		assert.strictEqual(tab.url(), 'http://localhost/1/');
	});
	
	await t.test('Use a control', async () => {
		const newTitle = 'Buy cheese';
		await tab.goto(baseUrl);

		await tab.hypermap.$('newTodo', { title: newTitle });
		
		assert.strictEqual(tab.hypermap.at('todos').length(), 2);
		assert.strictEqual(tab.hypermap.at('todos', 1, 'title'), newTitle);
	});
	
	await t.test('Load a script', async () => {
		await tab.goto(baseUrl + 'scripts/', { waitUntil: 'networkidle0' });
		
		assert.strictEqual(tab.hypermap.at('foo'), 'bar');
	});

	await t.test('Handle an event (script to script)', async () => {
		await tab.goto(baseUrl + 'scripts/', { waitUntil: 'networkidle0' });
		await tab.hypermap.set('input', 'test');

		assert.strictEqual(tab.hypermap.at('output'), 1);
	});

	await t.test('Load a document with transclusions', async () => {
		await tab.goto(baseUrl + 'transclude/', { waitUntil: 'networkidle0'});

		assert.strictEqual(tab.hypermap.at('todos').has('completed'), true);
		// Node strictEqual considers 0 === undefined?!
		assert.strictEqual(tab.hypermap.at('todos', 'completed'), 0);
	});

	await t.test('Fetching a transcluded node', async () => {
		await tab.goto(baseUrl + 'transclude/', { waitUntil: 'networkidle0'});
		assert.strictEqual(tab.hypermap.at('counter', 'count'), 0);

		await tab.hypermap.$('counter');

		assert.strictEqual(tab.hypermap.at('counter', 'count'), 1);
	});

	await mech.close();
});
