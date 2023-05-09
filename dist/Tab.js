"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: ()=>Tab
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
    page;
    hypermap = null;
    constructor(page){
        super();
        this.page = page;
        this.page.on('contentchanged', async ()=>{
            await this.syncData();
            this.emit('contentchanged');
        });
        this.page.on('console', (msg)=>{
            this.emit('console', msg);
        });
    }
    async goto(...args) {
        await this.page.goto(...args);
        await this.syncData();
    }
    url() {
        return this.page.url();
    }
    async syncData() {
        const hypermapJson = await this.page.evaluate(()=>{
            return globalThis.serializedHypermap();
        });
        const unwrappedHypermap = _Hypermap.default.fromLiteral(hypermapJson);
        const proxy = new _HyperProxyHandler.default(this.page, this);
        this.hypermap = new Proxy(unwrappedHypermap, proxy);
    }
}

//# sourceMappingURL=Tab.js.map