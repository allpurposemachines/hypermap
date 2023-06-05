"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: ()=>Hyperlist
});
const _Hypermap = /*#__PURE__*/ _interop_require_default(require("./Hypermap.js"));
const _json_processing = require("./utils/json_processing.js");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
class Hyperlist extends EventTarget {
    array;
    #parent;
    constructor(array, parent){
        super();
        this.array = array;
        this.#parent = parent;
    }
    static fromLiteral(array, parent) {
        const hyperlist = new this([], parent);
        const convertedArray = array.map((value)=>{
            if ((0, _json_processing.isMap)(value)) {
                return _Hypermap.default.fromLiteral(value, hyperlist);
            } else if (Array.isArray(value)) {
                return this.fromLiteral(value, hyperlist);
            } else {
                return value;
            }
        });
        hyperlist.array = convertedArray;
        return hyperlist;
    }
    at(...path) {
        if (path.length === 0) {
            return this;
        }
        const head = this.array.at(path.at(0));
        if (head === undefined || path.length > 1 && typeof head.at !== 'function') {
            return undefined;
        }
        if (path.length === 1) {
            return head;
        } else {
            return head.at(...path.slice(1));
        }
    }
    forEach(...args) {
        this.array.forEach(...args);
    }
    length() {
        return this.array.length;
    }
    prepend(value) {
        this.array.unshift(value);
    }
    append(value) {
        this.array.push(value);
    }
    set(index, value) {
        this.array[index] = value;
    }
    insert(index, value) {
        this.array.splice(index, 0, value);
    }
    delete(index) {
        this.array.splice(index, 1);
    }
    parent() {
        return this.#parent;
    }
    children() {
        return this.array.filter((value)=>value.isCollection && value.isCollection());
    }
    path() {
        if (this.parent() === null) {
            return [];
        } else {
            return this.parent().path().concat(this.parent().keyFor(this));
        }
    }
    async $(key, values) {
        const node = this.at(key);
        if (values) {
            Object.entries(values).forEach(([key, value])=>{
                node.set(key, value);
            });
        }
        await node.fetch();
    }
    isCollection() {
        return true;
    }
    keyFor(node) {
        this.array.indexOf(node);
    }
    toJSON() {
        return this.array;
    }
}

//# sourceMappingURL=Hyperlist.js.map