"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    default: ()=>Mech,
    Tab: ()=>_Tab.default
});
const _puppeteer = /*#__PURE__*/ _interop_require_default(require("puppeteer"));
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _Tab = /*#__PURE__*/ _interop_require_default(require("./Tab.js"));
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
class Mech {
    /** @type { puppeteer.Browser= } */ #browser;
    static async launch() {
        const mech = new Mech();
        mech.#browser = await _puppeteer.default.launch();
        return mech;
    }
    /** @param { { debug?: boolean } } options */ async newTab(options = {}) {
        if (!this.#browser) {
            throw new Error('Mech not launched yet');
        }
        const page = await this.#browser.newPage();
        if (options.debug) {
            await page.setRequestInterception(true);
            page.on('console', (msg)=>console.log('PAGE LOG:', msg.text()));
        }
        await page.exposeFunction('contentChanged', ()=>{
            page.emit('contentchanged');
        });
        const shim = _fs.readFileSync(new URL('assets/shim.js', require("url").pathToFileURL(__filename).toString()), 'utf8');
        page.on('load', async ()=>{
            await page.evaluate(shim);
        });
        return new _Tab.default(page);
    }
    async tabs() {
        return await this.#browser?.pages();
    }
    async close() {
        await this.#browser?.close();
    }
}

//# sourceMappingURL=Mech.js.map