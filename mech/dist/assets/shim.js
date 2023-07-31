"use strict";
(() => {
  // src/utils/json_processing.js
  var isMap = (value) => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  };

  // src/Hyperlist.js
  var Hyperlist = class extends EventTarget {
    array;
    #parent;
    /**
     * @param { import('./Hypermap.js').Value[] } array 
     * @param { import('./Hypermap.js').Node } parent 
     */
    constructor(array, parent) {
      super();
      this.array = array;
      this.#parent = parent;
    }
    /** @param { unknown } value */
    static isHyperlist(value) {
      return value instanceof Hyperlist;
    }
    /**
     * @param { unknown[] } array
     * @param { import('./Hypermap.js').Node } parent
     */
    static fromLiteral(array, parent) {
      const hyperlist = new this([], parent);
      const convertedArray = array.map((value) => {
        if (isMap(value)) {
          const hypermapLiteral = (
            /** @type { import('./Hypermap.js').HypermapLiteral } */
            value
          );
          return Hypermap.fromLiteral(hypermapLiteral, hyperlist);
        } else if (Array.isArray(value)) {
          return this.fromLiteral(value, hyperlist);
        } else {
          const valueLiteral = (
            /** @type { import('./Hypermap.js').ValueLiteral} */
            value
          );
          return valueLiteral;
        }
      });
      hyperlist.array = convertedArray;
      return hyperlist;
    }
    async hydrate() {
      this.children().forEach((child) => {
        child.hydrate();
      });
    }
    /**
     * @param { (string|number)[] } path
     * @returns { import('./Hypermap.js').Value | undefined }
     */
    at(...path) {
      if (path.length === 0) {
        return this;
      }
      const head = this.array.at(
        /** @type { number } */
        path.at(0)
      );
      if (head === void 0 || path.length > 1 && !(Hyperlist.isHyperlist(head) || Hypermap.isHypermap(head))) {
        return void 0;
      }
      if (path.length === 1) {
        return head;
      } else {
        const node = (
          /** @type { import('./Hypermap.js').Node } */
          head
        );
        return node.at(...path.slice(1));
      }
    }
    /** @param { (value: import('./Hypermap.js').Value, index: number) => void } callback */
    forEach(callback) {
      this.array.forEach(callback);
    }
    length() {
      return this.array.length;
    }
    /** @param { import('./Hypermap.js').Value } value */
    prepend(value) {
      this.array.unshift(value);
    }
    /** @param { import('./Hypermap.js').Value } value */
    append(value) {
      this.array.push(value);
    }
    /**
     * @param { number } index
     * @param { import('./Hypermap.js').Value } value
     * */
    set(index, value) {
      this.array[index] = value;
    }
    /**
     * @param { number } index
     * @param { import('./Hypermap.js').Value } value
     * */
    insert(index, value) {
      this.array.splice(index, 0, value);
    }
    /**
     * @param { number } index
     * */
    delete(index) {
      this.array.splice(index, 1);
    }
    parent() {
      return this.#parent;
    }
    /** @returns { import('./Hypermap.js').Node[] } */
    children() {
      const nodeArray = this.array.filter((value) => Hyperlist.isHyperlist(value) || Hypermap.isHypermap(value));
      return (
        /** @type { import('./Hypermap.js').Node[] } */
        nodeArray
      );
    }
    /** @returns { (string|number)[] } */
    path() {
      if (this.parent() === null) {
        return [];
      } else {
        const key = (
          /** @type { number } */
          this.parent().keyFor(this)
        );
        return this.parent().path().concat(key);
      }
    }
    /**
     * @param { string } key 
     * @param { unknown } values 
     */
    async $(key, values) {
      const unknownVal = this.at(key);
      if (!Hypermap.isHypermap(unknownVal)) {
        return;
      }
      const hypermap = (
        /** @type { Hypermap } */
        unknownVal
      );
      if (values) {
        Object.entries(values).forEach(([key2, value]) => {
          hypermap.set(key2, value);
        });
      }
      await hypermap.fetch();
    }
    /** @param { import('./Hypermap.js').Node } node */
    keyFor(node) {
      return this.array.indexOf(node);
    }
    toJSON() {
      return this.array;
    }
  };

  // src/Hypermap.js
  var Hypermap = class extends EventTarget {
    /** @type { Attributes } */
    attributes;
    map;
    /** @type { Node | null } */
    #parent;
    /**
     * @param { object } data
     * @param { Attributes } attributes
     * @param { Node | null } parent
     */
    constructor(data, attributes, parent) {
      super();
      this.map = new Map(Object.entries(data));
      this.attributes = attributes;
      this.#parent = parent;
    }
    /** @param { unknown } value */
    static isHypermap(value) {
      return value instanceof Hypermap;
    }
    /**
     * @param { HypermapLiteral } object
     * @param { Node | null } parent
     */
    static fromLiteral(object, parent = null) {
      const attributes = object["@"] ?? {};
      delete object["@"];
      let hypermap = new this(object, attributes, parent);
      hypermap.forEach(
        /**
         * @param { string } key
         * @param { unknown } value
        */
        (value, key) => {
          if (isMap(value)) {
            const hypermapLiteral = (
              /** @type { HypermapLiteral } */
              value
            );
            hypermap.map.set(key, this.fromLiteral(hypermapLiteral, hypermap));
          } else if (Array.isArray(value)) {
            const hyperlistLiteral = (
              /** @type { HyperlistLiteral } */
              value
            );
            hypermap.map.set(key, Hyperlist.fromLiteral(hyperlistLiteral, hypermap));
          }
        }
      );
      return hypermap;
    }
    async hydrate() {
      if (this.attributes.script) {
        try {
          await import(this.attributes.script);
        } catch (err) {
          console.log(`Error importing script at ${this.attributes.script}`, err.message);
        }
      }
      if (this.attributes.rels?.includes("transclude")) {
        await this.fetchTransclusion();
      }
      this.children().forEach((child) => {
        child.hydrate();
      });
    }
    async fetch() {
      if (this.attributes.href === null || this.attributes.href === void 0) {
        return Promise.reject("No href");
      }
      const method = this.attributes.method || "get";
      const url = new URL(this.attributes.href, window.location.href);
      if (method === "get") {
        if (this.attributes.rels?.includes("transclude")) {
          await this.fetchTransclusion();
        } else {
          window.location.assign(url);
        }
        return;
      }
      const headers = {
        "Content-Type": "application/json"
      };
      const body = {};
      this.forEach((value, key) => {
        body[key] = value;
      });
      const options = { method, headers, body: JSON.stringify(body) };
      const response = await fetch(url, options);
      if (response.redirected) {
        window.location.assign(response.url);
      }
    }
    /**
     * @param { string } key
     * @param { Record<string, Value>= } values
    */
    async $(key, values) {
      const node = this.at(key);
      if (values) {
        Object.entries(values).forEach(([key2, value]) => {
          node.set(key2, value);
        });
      }
      await node.fetch();
    }
    /** @param { (value: Value, key: string) => void } callback */
    forEach(callback) {
      this.map.forEach(callback);
    }
    /** @param { (string|number)[] } path */
    at(...path) {
      if (path.length === 0) {
        return this;
      }
      const head = this.map.get(path.at(0));
      if (head === void 0 || path.length > 1 && typeof head.at !== "function") {
        return void 0;
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
    /** @returns { Node[] } */
    children() {
      return [...this.map.values()].filter((value) => value.isCollection && value.isCollection());
    }
    /** @returns { (string|number)[] } */
    path() {
      if (this.parent() === null) {
        return [];
      } else {
        const parent = (
          /** @type { Node } */
          this.parent()
        );
        const key = (
          /** @type { string } */
          parent.keyFor(this)
        );
        return parent.path().concat(key);
      }
    }
    /** @param { Hypermap | Hyperlist } node */
    keyFor(node) {
      for (const [key, value] of this.map) {
        if (value === node) {
          return key;
        }
      }
      return void 0;
    }
    /** @param { string } key */
    has(key) {
      return this.map.has(key);
    }
    /**
     * @param { string } key
     * @param { Value } value
     */
    set(key, value) {
      this.map.set(key, value);
      if (window) {
        const event = new CustomEvent("changed", { detail: { key, value } });
        this.dispatchEvent(event);
        window.contentChanged();
      }
      return this;
    }
    /** @param { string } key */
    delete(key) {
      this.map.delete(key);
    }
    keys() {
      return this.map.keys();
    }
    /** @param { Hypermap } otherHypermap */
    replace(otherHypermap) {
      this.map = otherHypermap.map;
      return this;
    }
    length() {
      return [...this.map.values()].length;
    }
    isCollection() {
      return true;
    }
    async fetchTransclusion() {
      if (this.attributes.href) {
        const response = await fetch(this.attributes.href);
        const json = await response.json();
        const newNode = this.constructor.fromLiteral(json);
        this.replace(newNode);
      }
    }
    toJSON() {
      const obj = Object.fromEntries(this.map);
      if (Object.entries(this.attributes).length > 0) {
        obj["@"] = this.attributes;
      }
      return obj;
    }
    toString() {
      return JSON.stringify(this, null, 2);
    }
  };

  // src/assets/shim.js
  var pre = document.body.querySelector("pre");
  if (pre) {
    const serializedHypermap = pre.innerHTML;
    const jsonHypermap = JSON.parse(serializedHypermap);
    globalThis.hypermap = Hypermap.fromLiteral(jsonHypermap);
    globalThis.hypermap.hydrate();
    globalThis.serializedHypermap = () => {
      return JSON.parse(JSON.stringify(globalThis.hypermap));
    };
  } else {
    console.log("No pre element");
  }
})();
