/* eslint-disable no-undef */
hypermap.set('foo', 'bar');

console.log('Test event propagation!');

let counter = 0;
hypermap.addEventListener('changed', (event) => {
	if (event.detail.key === 'input') {
		counter += 1;
		hypermap.set('output', counter);
	}
});
