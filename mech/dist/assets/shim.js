(() => {
  // src/utils/json_processing.js
  var isMap = (value) => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  };

  // src/Hyperlist.js
  var Hyperlist = class extends EventTarget {
    array;
    #parent;
    constructor(array, parent) {
      super();
      this.array = array;
      this.#parent = parent;
    }
    static fromLiteral(array, parent) {
      const hyperlist = new this([], parent);
      const convertedArray = array.map((value) => {
        if (isMap(value)) {
          return Hypermap.fromLiteral(value, hyperlist);
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
      if (head === void 0 || path.length > 1 && typeof head.at !== "function") {
        return void 0;
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
      return this.array.filter((value) => value.isCollection && value.isCollection());
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
        Object.entries(values).forEach(([key2, value]) => {
          node.set(key2, value);
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
  };

  // src/Hypermap.js
  var Hypermap = class extends EventTarget {
    attributes;
    map;
    #parent;
    constructor(data, attributes, parent) {
      super();
      this.map = new Map(Object.entries(data));
      this.attributes = attributes;
      this.#parent = parent;
    }
    static fromLiteral(object, parent = null) {
      const attributes = object["@"] || {};
      delete object["@"];
      let hypermap = new this(object, attributes, parent);
      hypermap.forEach((value, key) => {
        if (isMap(value)) {
          hypermap.map.set(key, this.fromLiteral(value, hypermap));
        } else if (Array.isArray(value)) {
          hypermap.map.set(key, Hyperlist.fromLiteral(value, hypermap));
        }
      });
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
    async $(key, values) {
      const node = this.at(key);
      if (values) {
        Object.entries(values).forEach(([key2, value]) => {
          node.set(key2, value);
        });
      }
      await node.fetch();
    }
    forEach(callbackfn) {
      this.map.forEach(callbackfn);
    }
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
    children() {
      return [...this.map.values()].filter((value) => value.isCollection && value.isCollection());
    }
    path() {
      if (this.parent() === null) {
        return [];
      } else {
        return this.parent().path().concat(this.parent().keyFor(this));
      }
    }
    keyFor(node) {
      for (const [key, value] of this.map) {
        if (value === node) {
          return key;
        }
      }
      return void 0;
    }
    has(key) {
      return this.map.has(key);
    }
    set(key, value) {
      this.map.set(key, value);
      if (window) {
        const event = new CustomEvent("changed", { detail: { key, value } });
        this.dispatchEvent(event);
        window.contentChanged();
      }
      return this;
    }
    delete(key) {
      this.map.delete(key);
    }
    keys() {
      return this.map.keys();
    }
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
      const response = await fetch(this.attributes.href);
      const json = await response.json();
      const newNode = this.constructor.fromLiteral(json);
      this.replace(newNode);
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
