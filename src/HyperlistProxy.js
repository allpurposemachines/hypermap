import Hyperlist from "../dist/Hyperlist";
import HypermapProxy from "../dist/HypermapProxy";

export default class HyperlistProxy extends Hyperlist {
	tab;

	static hypermapFromProxy(object, parent) {
		const hypermap = HypermapProxy.fromLiteral(object, parent);
		hypermap.tab = this.tab;
		return hypermap;
	}

	async $(key, body) {
		const node = this.at(key);
		const page = this.tab.page;

		let promises = [
			page.evaluate(async (path, body) => {
				const innerNode = globalThis.hypermap.at(...path);
				if (body) {
					Object.entries(body).forEach((value, key) => {
						innerNode.set(key, value);
					});
				}
				await innerNode.fetch();
			}, node.path(), body)
		];

		if (!node.attributes.rels?.includes('transclude')) {
			promises.push(page.waitForNavigation());
		}
		
		await Promise.all(promises);
		await this.tab.syncData();
	}
}
