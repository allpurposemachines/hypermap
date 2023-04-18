"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Client", {
    enumerable: true,
    get: ()=>Client
});
const _puppeteer = /*#__PURE__*/ _interop_require_default(require("puppeteer"));
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _Hypermap = /*#__PURE__*/ _interop_require_default(require("./Hypermap.js"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
class Client {
    browser;
    static async launch() {
        const client = new Client();
        client.browser = await _puppeteer.default.launch();
        return client;
    }
    async newTab(options = {}) {
        const tab = await this.browser?.newPage();
        if (options.debug) {
            await tab?.setRequestInterception(true);
            tab?.on('console', (msg)=>console.log('PAGE LOG:', msg.text()));
        }
        await tab.exposeFunction('contentChanged', ()=>{
            tab.emit('contentchanged');
        });
        const shim = _fs.readFileSync(new URL('assets/shim.js', require("url").pathToFileURL(__filename).toString()), 'utf8');
        tab.on('load', async ()=>{
            await tab.evaluate(shim);
        });
        tab.data = async function() {
            const hypermapJson = await this.evaluate(()=>{
                return globalThis.serializedHypermap();
            });
            return _Hypermap.default.fromJSON(hypermapJson, [], [], null, this);
        };
        tab.fetch = async function(path) {
            const node = (await this.data()).at(...path);
            if (node.attributes.rels?.includes('transclude')) {
                await this.evaluate(async (path)=>{
                    // eslint-disable-next-line no-undef
                    await hypermap.at(...path).fetch();
                }, path);
            } else {
                await Promise.all([
                    this.waitForNavigation(),
                    this.evaluate((path)=>{
                        // eslint-disable-next-line no-undef
                        hypermap.at(...path).fetch();
                    }, path)
                ]);
            }
        };
        tab.at = async function(...path) {
            const hypermap1 = await this.data();
            return hypermap1.at(...path);
        };
        return tab;
    }
    async tabs() {
        return await this.browser?.pages();
    }
    async close() {
        await this.browser?.close();
    }
}
