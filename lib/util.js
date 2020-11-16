"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Util = void 0;
class Util {
    static arrayConcat(objValue, srcValue) {
        if (Array.isArray(objValue)) {
            return objValue.concat(srcValue);
        }
    }
}
exports.Util = Util;
//# sourceMappingURL=util.js.map