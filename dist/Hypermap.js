"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Hypermap", {
    enumerable: true,
    get: ()=>Hypermap
});
const _json_processing = require("./utils/json_processing.js");
class Hypermap extends EventTarget {
    attributes;
    map;
    constructor(data, attributes){
        super();
        this.map = new Map(data);
        this.attributes = new Map(attributes);
    }
    static fromJSON(object) {
        const entries = Object.entries(object);
        const attributes = entries.find(([key])=>key === "@")?.at(1) || {};
        const data = entries.filter(([key])=>key !== "@");
        const hypermap = new Hypermap(data, Object.entries(attributes));
        hypermap.forEach(async (value, key)=>{
            if ((0, _json_processing.isMap)(value)) {
                hypermap.set(key, await this.fromJSON(value));
            } else if (Array.isArray(value)) {
                value.map(async (item, index)=>{
                    if ((0, _json_processing.isMap)(item)) {
                        value[index] = await this.fromJSON(item);
                    }
                });
            }
        });
        return hypermap;
    }
    // Accessors
    forEach(callbackfn) {
        this.map.forEach(callbackfn);
    }
    keys() {
        return this.map.keys();
    }
    has(key) {
        return this.map.has(key);
    }
    get(key) {
        return this.map.get(key);
    }
    deepGet(path) {
        let currentNode = this;
        path.forEach((segment)=>{
            // Is this valid? Can maps have numerical keys?
            const index = parseInt(segment);
            if (!Number.isNaN(index)) {
                currentNode = currentNode.at(index);
            } else {
                currentNode = currentNode.get(segment);
            }
        });
        return currentNode;
    }
    isTransclusion() {
        return this.attributes.has('rels') && this.attributes.get('rels').includes('transclude');
    }
    // Modifiers
    // TODO: this only changes it client-side
    async set(key, val) {
        this.map.set(key, val);
        this.dispatchEvent(new Event('changed'));
        return this;
    }
    // Conversions
    toJSON() {
        const obj = Object.fromEntries(this.map);
        if (this.attributes.size > 0) {
            obj['@'] = Object.fromEntries(this.attributes);
        }
        return obj;
    }
    toString() {
        return JSON.stringify(this);
    }
}
