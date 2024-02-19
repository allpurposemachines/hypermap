// @ts-nocheck

import { Hypermap, Hyperlist } from '@allpurposemachines/hypermap-shim';

export default class HyperProxyHandler {
	browserContext;

	/**
	 * @param { import('puppeteer').Page } browserContext
	 * @param { import('./Tab.js').default } tab
	 */
	constructor(browserContext, tab) {
		this.browserContext = browserContext;
		this.tab = tab;
	}

	/**
	 * @param { import('./Hypermap.js').Node } target
	 * @param { string } prop
	 */
	get(target, prop) {
		if (prop === '$') {
			/**
			 * @param { string } key
			 * @param { unknown } body
			 */
			return async (key, body) => {
				const node = target.at(key);
				let promises = [];

				promises.push(
					this.browserContext.evaluate(async (path, key, body) => {
						// @ts-expect-error
						const innerNode = globalThis.hypermap.at(...path);
						await innerNode.$(key, body);
					}, target.path(), key, body)
				);

				if (!node.attributes.rels?.includes('transclude')) {
					promises.push(this.browserContext.waitForNavigation({ waitUntil: 'networkidle0' }));
				}

				await Promise.all(promises);
				await this.tab.syncData();
			}
		}

		if (prop === 'set') {
			/**
			 * @param { string } key
			 * @param { import("./Hypermap.js").Value } value
			 */
			return async (key, value) => {
				await this.browserContext.evaluate(async (path, key, value) => {
					// @ts-expect-error
					const innerNode = globalThis.hypermap.at(...path);
					await innerNode.set(key, value);
				}, target.path(), key, value);
				await this.tab.syncData();
				return this.tab.hypermap?.at(target.path());
			}
		}

		const value = target[prop];
		if (value instanceof Function) {
			/**
			 * @param { unknown[] } args
			 */
			return (...args) => {
				const res = target[prop].apply(target, args);
				if (Hypermap.isHypermap(res) || Hyperlist.isHyperlist(res)) {
					return new Proxy(res, this);
				}
				return res;
			};
		}
		return value;
	}
}
