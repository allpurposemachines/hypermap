"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: ()=>Hypermap
});
const _json_processing = require("./utils/json_processing.js");
class Hypermap extends EventTarget {
    attributes;
    map;
    #parent;
    #tab;
    constructor(data, attributes, parent, tab = null){
        super();
        this.map = new Map(Object.entries(data));
        this.attributes = attributes;
        this.#parent = parent;
        this.#tab = tab;
    }
    static fromJSON(object, scripts = [], transcludedNodes = [], parent = null, tab = null) {
        const attributes = object['@'] || {};
        delete object['@'];
        let hypermap = new this(object, attributes, parent, tab);
        hypermap.forEach((value, key)=>{
            if ((0, _json_processing.isMap)(value)) {
                hypermap.map.set(key, this.fromJSON(value, scripts, transcludedNodes, hypermap, tab));
            } else if (Array.isArray(value)) {
                value.map((item, index)=>{
                    if ((0, _json_processing.isMap)(item)) {
                        value[index] = this.fromJSON(item, scripts, transcludedNodes, hypermap, tab);
                    }
                });
            }
        });
        // Push transcluded nodes to a list to load later
        if (attributes.rels?.includes('transclude')) {
            transcludedNodes.push(hypermap);
        }
        // Push script URLs to a queue to load later
        if (attributes.script && typeof window !== 'undefined') {
            const url = new URL(attributes.script, window.location.href);
            scripts.push(url);
        }
        return hypermap;
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
        this.parent;
    }
    children() {
        return [
            ...this.map
        ].filter(([_, value])=>(0, _json_processing.isMap)(value) || Array.isArray(value)).map(([_, value])=>value);
    }
    path() {
        if (this.#parent !== null && this.#parent?.constructor.name !== 'Hypermap') {
            throw new Error('Not root and parent is not a hypermap');
        }
        if (this.#parent === null) {
            return [];
        } else {
            return this.#parent.path().concat(this.#parent.keyFor(this));
        }
    }
    keyFor(node) {
        for (const [key, value] of this.map){
            // console.log('LOOKING', value.toString(), node.toString());
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
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('changed', {
                detail: {
                    key,
                    value
                }
            });
            this.dispatchEvent(event);
            window.contentChanged();
            return this;
        } else if (this.#tab) {
            const path = this.path();
            this.#tab.evaluate((path, key, value)=>{
                globalThis.hypermap.at(...path).set(key, value);
            }, path, key, value).then(()=>{
                return this;
            });
        }
    }
    keys() {
        return this.map.keys();
    }
    replace(otherHypermap) {
        this.map = otherHypermap.map;
        return this;
    }
    // Todo: make isomorphic
    async fetchTransclusion() {
        const response = await fetch(this.attributes.href);
        const json = await response.json();
        // Todo: should handle scripts and sub-transclusions
        const newNode = await Hypermap.fromJSON(json, [], []);
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
