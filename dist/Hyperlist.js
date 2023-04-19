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
                return _Hypermap.default.fromJSON(value, [], [], hyperlist);
            } else if (Array.isArray(value)) {
                return Hyperlist.fromLiteral(value, hyperlist);
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
    length() {
        return this.array.length;
    }
    toJSON() {
        return this.array;
    }
}

//# sourceMappingURL=Hyperlist.js.map