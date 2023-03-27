hypermap.set('foo', 'bar');

let counter = 0;
hypermap.addEventListener('changed', (event) => {
  console.log('changed!', event.detail.key);
  if (event.detail.key === 'input') {
    counter += 1;
    hypermap.set('output', counter);
  }
});

