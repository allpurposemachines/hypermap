"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: ()=>HyperlistProxy
});
const _Hyperlist = /*#__PURE__*/ _interop_require_default(require("../dist/Hyperlist"));
const _HypermapProxy = /*#__PURE__*/ _interop_require_default(require("../dist/HypermapProxy"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
class HyperlistProxy extends _Hyperlist.default {
    tab;
    static hypermapFromProxy(object, parent) {
        const hypermap = _HypermapProxy.default.fromLiteral(object, parent);
        hypermap.tab = this.tab;
        return hypermap;
    }
    async $(key, body) {
        const node = this.at(key);
        const page = this.tab.page;
        let promises = [
            page.evaluate(async (path, body)=>{
                const innerNode = globalThis.hypermap.at(...path);
                if (body) {
                    Object.entries(body).forEach((value, key)=>{
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

//# sourceMappingURL=HyperlistProxy.js.map