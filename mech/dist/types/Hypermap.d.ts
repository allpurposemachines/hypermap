/** @typedef { {href?: string, method?: string, rels?: string[], script?: string} } Attributes */
/** @typedef { null | boolean | number | string } ValueLiteral */
/** @typedef { Record<string, unknown> } HypermapLiteral */
/** @typedef { unknown[] } HyperlistLiteral */
/** @typedef { Hypermap | Hyperlist } Node */
/** @typedef { Node | ValueLiteral } Value */
export default class Hypermap extends EventTarget {
    /** @param { unknown } value */
    static isHypermap(value: unknown): boolean;
    /**
     * @param { HypermapLiteral } object
     * @param { Node | null } parent
     */
    static fromLiteral(object: HypermapLiteral, parent?: Node | null): Hypermap;
    /**
     * @param { object } data
     * @param { Attributes } attributes
     * @param { Node | null } parent
     */
    constructor(data: object, attributes: Attributes, parent: Node | null);
    /** @type { Attributes } */
    attributes: Attributes;
    map: Map<string, any>;
    hydrate(): Promise<void>;
    fetch(): Promise<undefined>;
    /**
     * @param { string } key
     * @param { Record<string, Value>= } values
    */
    $(key: string, values?: Record<string, Value> | undefined): Promise<void>;
    /** @param { (value: Value, key: string) => void } callback */
    forEach(callback: (value: Value, key: string) => void): void;
    /** @param { (string|number)[] } path */
    at(...path: (string | number)[]): any;
    parent(): Node | null;
    /** @returns { Node[] } */
    children(): Node[];
    /** @returns { (string|number)[] } */
    path(): (string | number)[];
    /** @param { Hypermap | Hyperlist } node */
    keyFor(node: Hypermap | Hyperlist): string | undefined;
    /** @param { string } key */
    has(key: string): boolean;
    /**
     * @param { string } key
     * @param { Value } value
     */
    set(key: string, value: Value): this;
    /** @param { string } key */
    delete(key: string): void;
    keys(): IterableIterator<string>;
    /** @param { Hypermap } otherHypermap */
    replace(otherHypermap: Hypermap): this;
    length(): number;
    isCollection(): boolean;
    fetchTransclusion(): Promise<void>;
    toJSON(): {
        [k: string]: any;
    };
    #private;
}
export type Attributes = {
    href?: string;
    method?: string;
    rels?: string[];
    script?: string;
};
export type ValueLiteral = null | boolean | number | string;
export type HypermapLiteral = Record<string, unknown>;
export type HyperlistLiteral = unknown[];
export type Node = Hypermap | Hyperlist;
export type Value = Node | ValueLiteral;
import Hyperlist from './Hyperlist.js';
//# sourceMappingURL=Hypermap.d.ts.map