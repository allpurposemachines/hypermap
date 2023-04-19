import Hypermap from '../Hypermap.js';

const serializedHypermap = document.body.querySelector('pre').innerHTML;
const jsonHypermap = JSON.parse(serializedHypermap);

globalThis.hypermap = Hypermap.fromLiteral(jsonHypermap);
globalThis.hypermap.hydrate();

globalThis.serializedHypermap = () => {
	// TODO: toJSON() doesn't work with tab data... why?
	return JSON.parse(JSON.stringify(globalThis.hypermap));
};
