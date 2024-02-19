import test from 'node:test';
import assert from 'assert';
import mockTodoServer from './mockTodoServer.js';

import { Mech } from '../src/Mech.js';

const baseUrl = 'http://localhost/';
const mockServer = mockTodoServer(baseUrl);

Mech.debug = true;
Mech.debugRequestHandler = request => {
	if (request.url().startsWith(baseUrl)) {
		mockServer.handleRequest(request);
	} else {
		request.continue();
	}
};
const tab = await Mech.open(baseUrl);

test('Given a tab', async (t) => {

	t.afterEach(async () => {
		mockServer.reset()
		await tab.open(baseUrl);
	});

	await t.test('Direct navigation', async () => {
		assert.strictEqual(tab.url(), baseUrl);
	});
	
	await t.test('Load a basic HyperMap', async () => {
		assert.strictEqual(tab.hypermap?.at('completed'), 0);
		assert.strictEqual(tab.hypermap?.at('todos').length(), 1);
		assert.strictEqual(tab.hypermap?.has('newTodo'), true);
		assert.strictEqual(tab.hypermap?.at('completed', 'badPath'), undefined);
	});

	await t.test('Navigate the hierarchy', async () => {
		await tab.open(baseUrl + 'deep/');

		assert.deepStrictEqual(tab.hypermap?.path(), []);
		assert.deepStrictEqual(tab.hypermap?.at('one', 'two', 'three').path(), ['one', 'two', 'three']);

		assert.strictEqual(tab.hypermap?.children().length, 1);
		assert.strictEqual(tab.hypermap?.parent(), null);
		assert.deepStrictEqual(tab.hypermap?.at('one').parent(), tab.hypermap);
	});
	
	await t.test('Follow a link', async () => {
		await tab.hypermap?.at('todos').$(0);
		
		await tab.syncData();
		assert.strictEqual(tab.hypermap?.has('title'), true);
		assert.strictEqual(tab.url(), 'http://localhost/1/');
	});
	
	await t.test('Use a control', async () => {
		const newTitle = 'Buy cheese';
		await tab.hypermap?.$('newTodo', { title: newTitle });
		
		assert.strictEqual(tab.hypermap?.at('todos').length(), 2);
		assert.strictEqual(tab.hypermap?.at('todos', 1, 'title'), newTitle);
	});
	
	await t.test('Load a script', async () => {
		await tab.open(baseUrl + 'scripts/');
		
		assert.strictEqual(tab.hypermap?.at('foo'), 'bar');
	});

	await t.test('Handle an event (script to script)', async () => {
		await tab.open(baseUrl + 'scripts/');
		await tab.hypermap?.set('input', 'test');

		assert.strictEqual(tab.hypermap?.at('output'), 1);
	});

	await t.test('Mainpulate nodes with a script', async () => {
		await tab.open(baseUrl + 'scripts/');
		
		assert.deepStrictEqual(tab.hypermap?.at('list').toJSON(), ['first', 'middle1', 'middle2', 'last']);
		assert.strictEqual(tab.hypermap?.has('bad'), false);
	});

	await t.test('Load a document with transclusions', async () => {
		await tab.open(baseUrl + 'transclude/');

		assert.strictEqual(tab.hypermap?.at('todos').has('completed'), true);
		// Node strictEqual considers 0 === undefined?!
		assert.strictEqual(tab.hypermap?.at('todos', 'completed'), 0);
	});

	await t.test('Fetching a transcluded node', async () => {
		await tab.open(baseUrl + 'transclude/');

		assert.strictEqual(tab.hypermap?.at('counter', 'count'), 0);

		await tab.hypermap?.$('counter');

		assert.strictEqual(tab.hypermap?.at('counter', 'count'), 1);
	});

	await Mech.close();
});
