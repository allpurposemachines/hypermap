import Hypermap from '../Hypermap.js';

let scripts = [];
let transcludedNodes = [];

const serializedHypermap = document.body.querySelector('pre').innerHTML;
const jsonHypermap = JSON.parse(serializedHypermap);

globalThis.hypermap = Hypermap.fromJSON(jsonHypermap, scripts, transcludedNodes);

scripts.forEach(async url => {
	try {
		await import(url);
	} catch(err) {
		console.log(`Error importing script at ${url}`, err.message);
	}
});

transcludedNodes.forEach(async node => {
	await node.fetchTransclusion();
});

globalThis.serializedHypermap = () => {
	// TODO: toJSON() doesn't work with tab data... why?
	return JSON.parse(JSON.stringify(globalThis.hypermap));
};
