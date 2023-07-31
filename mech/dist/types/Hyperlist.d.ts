export default class Hyperlist extends EventTarget {
    /** @param { unknown } value */
    static isHyperlist(value: unknown): boolean;
    /**
     * @param { unknown[] } array
     * @param { import('./Hypermap.js').Node } parent
     */
    static fromLiteral(array: unknown[], parent: import('./Hypermap.js').Node): Hyperlist;
    /**
     * @param { import('./Hypermap.js').Value[] } array
     * @param { import('./Hypermap.js').Node } parent
     */
    constructor(array: import('./Hypermap.js').Value[], parent: import('./Hypermap.js').Node);
    array: import("./Hypermap.js").Value[];
    hydrate(): Promise<void>;
    /**
     * @param { (string|number)[] } path
     * @returns { import('./Hypermap.js').Value | undefined }
     */
    at(...path: (string | number)[]): import('./Hypermap.js').Value | undefined;
    /** @param { (value: import('./Hypermap.js').Value, index: number) => void } callback */
    forEach(callback: (value: import('./Hypermap.js').Value, index: number) => void): void;
    length(): number;
    /** @param { import('./Hypermap.js').Value } value */
    prepend(value: import('./Hypermap.js').Value): void;
    /** @param { import('./Hypermap.js').Value } value */
    append(value: import('./Hypermap.js').Value): void;
    /**
     * @param { number } index
     * @param { import('./Hypermap.js').Value } value
     * */
    set(index: number, value: import('./Hypermap.js').Value): void;
    /**
     * @param { number } index
     * @param { import('./Hypermap.js').Value } value
     * */
    insert(index: number, value: import('./Hypermap.js').Value): void;
    /**
     * @param { number } index
     * */
    delete(index: number): void;
    parent(): import("./Hypermap.js").Node;
    /** @returns { import('./Hypermap.js').Node[] } */
    children(): import('./Hypermap.js').Node[];
    /** @returns { (string|number)[] } */
    path(): (string | number)[];
    /**
     * @param { string } key
     * @param { unknown } values
     */
    $(key: string, values: unknown): Promise<void>;
    /** @param { import('./Hypermap.js').Node } node */
    keyFor(node: import('./Hypermap.js').Node): number;
    toJSON(): import("./Hypermap.js").Value[];
    #private;
}
//# sourceMappingURL=Hyperlist.d.ts.map