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
    Mech: ()=>Mech,
    Tab: ()=>_Tab.Tab
});
const _puppeteer = /*#__PURE__*/ _interop_require_default(require("puppeteer"));
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _Tab = require("./Tab.js");
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
const Mech = {
    debug: false,
    debugRequestHandler: null,
    /** @type { puppeteer.Browser | null } */ browser: null,
    /** @param { string } url */ async open (url) {
        if (!this.browser) {
            this.browser = await _puppeteer.default.launch();
        }
        const page = await this.browser.newPage();
        if (this.debug) {
            await page.setRequestInterception(true);
            page.on('console', (msg)=>console.log('PAGE LOG:', msg.text()));
            if (this.debugRequestHandler) {
                page.on('request', this.debugRequestHandler);
            }
        }
        await page.exposeFunction('contentChanged', ()=>{
            page.emit('contentchanged');
        });
        const shim = _fs.readFileSync(new URL('assets/shim.js', require("url").pathToFileURL(__filename).toString()), 'utf8');
        page.on('load', async ()=>{
            await page.evaluate(shim);
        });
        const tab = new _Tab.Tab(page);
        await tab.open(url); //), { waitUntil: 'networkidle0' });
        return tab;
    },
    async tabs () {
        return await this.browser?.pages();
    },
    async close () {
        await this.browser?.close();
    }
};

//# sourceMappingURL=Mech.js.map