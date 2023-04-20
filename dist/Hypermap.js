"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: ()=>Hypermap
});
const _json_processing = require("./utils/json_processing.js");
const _Hyperlist = /*#__PURE__*/ _interop_require_default(require("./Hyperlist.js"));
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
class Hypermap extends EventTarget {
    attributes;
    map;
    #parent;
    constructor(data, attributes, parent){
        super();
        this.map = new Map(Object.entries(data));
        this.attributes = attributes;
        this.#parent = parent;
    }
    static fromLiteral(object, parent = null) {
        const attributes = object['@'] || {};
        delete object['@'];
        let hypermap = new this(object, attributes, parent);
        hypermap.forEach((value, key)=>{
            if ((0, _json_processing.isMap)(value)) {
                hypermap.map.set(key, this.fromLiteral(value, hypermap));
            } else if (Array.isArray(value)) {
                hypermap.map.set(key, _Hyperlist.default.fromLiteral(value, hypermap));
            }
        });
        return hypermap;
    }
    static isCollection(value) {
        return [
            'Hypermap',
            'Hyperlist'
        ].includes(value.constructor.name);
    }
    async hydrate() {
        if (this.attributes.script) {
            try {
                await Promise.resolve(this.attributes.script).then((p)=>/*#__PURE__*/ _interop_require_wildcard(require(p)));
            } catch (err) {
                console.log(`Error importing script at ${this.attributes.script}`, err.message);
            }
        }
        if (this.attributes.rels?.includes('transclude')) {
            this.fetchTransclusion();
        }
        this.children().forEach((child)=>{
            child.hydrate();
        });
    }
    // Todo: make isomorphic
    async fetch() {
        const method = this.attributes.method || 'get';
        const url = new URL(this.attributes.href, window.location);
        if (method === 'get') {
            if (this.attributes.rels?.includes('transclude')) {
                await this.fetchTransclusion();
            } else {
                window.location.assign(url);
            }
            return;
        }
        const headers = {
            'Content-Type': 'application/json'
        };
        const body = {};
        this.forEach((value, key)=>{
            body[key] = value;
        });
        const options = {
            method,
            headers,
            body: JSON.stringify(body)
        };
        const response = await fetch(url, options);
        if (response.redirected) {
            window.location.assign(response.url);
        }
    }
    forEach(callbackfn) {
        this.map.forEach(callbackfn);
    }
    at(...path) {
        if (path.length === 0) {
            return this;
        }
        const head = this.map.get(path.at(0));
        if (head === undefined || path.length > 1 && typeof head.at !== 'function') {
            return undefined;
        }
        if (path.length === 1) {
            return head;
        } else {
            return head.at(...path.slice(1));
        }
    }
    parent() {
        return this.#parent;
    }
    children() {
        return [
            ...this.map
        ].filter(([, value])=>Hypermap.isCollection(value)).map(([, value])=>value);
    }
    path() {
        if (this.#parent === null) {
            return [];
        } else {
            return this.#parent.path().concat(this.#parent.keyFor(this));
        }
    }
    keyFor(node) {
        for (const [key, value] of this.map){
            if (value === node) {
                return key;
            }
        }
        return undefined;
    }
    has(key) {
        return this.map.has(key);
    }
    set(key, value) {
        this.map.set(key, value);
        const event = new CustomEvent('changed', {
            detail: {
                key,
                value
            }
        });
        this.dispatchEvent(event);
        window.contentChanged();
        return this;
    }
    keys() {
        return this.map.keys();
    }
    replace(otherHypermap) {
        this.map = otherHypermap.map;
        return this;
    }
    length() {
        throw new Error('DRAGONS');
    }
    async fetchTransclusion() {
        const response = await fetch(this.attributes.href);
        const json = await response.json();
        // Todo: should handle scripts and sub-transclusions
        const newNode = Hypermap.fromLiteral(json);
        this.replace(newNode);
    }
    toJSON() {
        const obj = Object.fromEntries(this.map);
        if (Object.entries(this.attributes).length > 0) {
            obj['@'] = this.attributes;
        }
        return obj;
    }
    toString() {
        return JSON.stringify(this, null, 2);
    }
}

//# sourceMappingURL=Hypermap.js.map