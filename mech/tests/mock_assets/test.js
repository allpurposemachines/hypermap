/* eslint-disable no-undef */
// @ts-nocheck

// Map manipulation
hypermap.set('foo', 'bar');
hypermap.set('bad', true);
hypermap.delete('bad');

// List manipulation
const list = hypermap.at('list');
list.prepend('first');
list.append('last');
list.set(1, 'middle1');
list.insert(2, 'middle2');
list.insert(3, 'middle3');
list.delete(3);

console.log('Test event propagation!');

let counter = 0;
hypermap.addEventListener('changed', (event) => {
	if (event.detail.key === 'input') {
		counter += 1;
		hypermap.set('output', counter);
	}
});
