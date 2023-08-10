/** @param { unknown } value */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "isMap", {
    enumerable: true,
    get: function() {
        return isMap;
    }
});
const isMap = (value)=>{
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

//# sourceMappingURL=json_processing.js.map