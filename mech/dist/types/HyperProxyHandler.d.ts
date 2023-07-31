export default class HyperProxyHandler {
    /**
     * @param { import('puppeteer').Page } browserContext
     * @param { import('./Tab.js').default } tab
     */
    constructor(browserContext: import('puppeteer').Page, tab: import('./Tab.js').default);
    browserContext: import("puppeteer").Page;
    tab: import("./Tab.js").default;
    /**
     * @param { import('./Hypermap.js').Node } target
     * @param { string } prop
     */
    get(target: import('./Hypermap.js').Node, prop: string): any;
}
//# sourceMappingURL=HyperProxyHandler.d.ts.map