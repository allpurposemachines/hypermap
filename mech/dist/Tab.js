"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Tab", {
    enumerable: true,
    get: function() {
        return Tab;
    }
});
const _nodeevents = require("node:events");
const _Hypermap = /*#__PURE__*/ _interop_require_default(require("./Hypermap.js"));
const _HyperProxyHandler = /*#__PURE__*/ _interop_require_default(require("./HyperProxyHandler.js"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
class Tab extends _nodeevents.EventEmitter {
    /** @type { import('puppeteer').Page } */ page;
    /** @type { Hypermap | null } */ hypermap = null;
    /** @param { import('puppeteer').Page } page */ constructor(page){
        super();
        this.page = page;
        // @ts-expect-error
        this.page.on('contentchanged', async ()=>{
            await this.syncData();
            this.emit('contentchanged');
        });
        this.page.on('console', (msg)=>{
            this.emit('console', msg);
        });
    }
    /**
	 * @param { string } url
	 * @param { import('puppeteer').WaitForOptions= } options
	*/ async open(url, options = {
        waitUntil: 'networkidle0'
    }) {
        await this.page.goto(url, options);
        await this.syncData();
    }
    async close() {
        await this.page.close();
    }
    url() {
        return this.page.url();
    }
    async syncData() {
        const hypermapJson = await this.page.evaluate(()=>{
            // @ts-expect-error
            return globalThis.serializedHypermap();
        });
        const unwrappedHypermap = _Hypermap.default.fromLiteral(hypermapJson);
        const proxy = new _HyperProxyHandler.default(this.page, this);
        this.hypermap = /** @type { Hypermap } */ new Proxy(unwrappedHypermap, proxy);
    }
}

//# sourceMappingURL=Tab.js.map