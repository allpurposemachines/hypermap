// import HyperlistProxy from "./HyperlistProxy";
// import Hypermap from "./Hypermap";

export default class HyperProxyHandler {
	browserContext;

	constructor(browserContext, tab) {
		this.browserContext = browserContext;
		this.tab = tab;
	}

	get(target, prop) {
		if (prop === '$') {
			return async (key, body) => {
				const node = target.at(key);
				let promises = [];
				
				promises.push(
					this.browserContext.evaluate(async (path, key, body) => {
						const innerNode = globalThis.hypermap.at(...path);
						await innerNode.$(key, body);
					}, target.path(), key, body)
				);

				if (!node.attributes.rels?.includes('transclude')) {
					promises.push(this.browserContext.waitForNavigation());
				}

				await Promise.all(promises);
				await this.tab.syncData();
			}
		}

		if (prop === 'set') {
			return async (key, value) => {
				await this.browserContext.evaluate(async (path, key, value) => {
					const innerNode = globalThis.hypermap.at(...path);
					await innerNode.set(key, value);
				}, target.path(), key, value);
				await this.tab.syncData();
				return this.tab.hypermap.at(target.path());
			}
		}

		const value = target[prop];
		if (value instanceof Function) {
			return (...args) => {
				const res = target[prop].apply(target, args);
				if (res?.isCollection && res.isCollection()) {
					return new Proxy(res, this);
				}
				return res;
			};
		}
		return value;
	}
}
