(() => {
  // src/utils/json_processing.js
  var isMap = (value) => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  };

  // src/Hypermap.js
  var Hypermap = class extends EventTarget {
    attributes;
    map;
    constructor(data, attributes) {
      super();
      this.map = new Map(Object.entries(data));
      this.attributes = attributes;
    }
    static fromJSON(object, scripts2 = [], transcludedNodes2 = []) {
      const attributes = object["@"] || {};
      delete object["@"];
      let hypermap = new this(object, attributes);
      hypermap.forEach((value, key) => {
        if (isMap(value)) {
          hypermap.set(key, this.fromJSON(value, scripts2, transcludedNodes2));
        } else if (Array.isArray(value)) {
          value.map((item, index) => {
            if (isMap(item)) {
              value[index] = this.fromJSON(item, scripts2, transcludedNodes2);
            }
          });
        }
      });
      if (attributes.rels?.includes("transclude")) {
        transcludedNodes2.push(hypermap);
      }
      if (attributes.script && typeof window !== "undefined") {
        const url = new URL(attributes.script, window.location.href);
        scripts2.push(url);
      }
      return hypermap;
    }
    // Todo: make isomorphic
    async fetch() {
      const method = this.attributes.method || "get";
      const url = new URL(this.attributes.href, window.location);
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
    // Todo: this should forward to tab when running as client
    deepSet(path, value) {
      if (Array.isArray(path) && path.length > 0) {
        const key = path.pop();
        this.at(...path).set(key, value);
      } else {
        this.set(path, value);
      }
    }
    has(key) {
      return this.map.has(key);
    }
    // Todo: this should forward to tab when running as client
    set(key, value) {
      this.map.set(key, value);
      if (typeof CustomEvent !== "undefined") {
        const event = new CustomEvent("changed", { detail: { key, value } });
        this.dispatchEvent(event);
      }
      if (typeof window !== "undefined") {
        window.contentChanged();
      }
      return this;
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
      const newNode = await Hypermap.fromJSON(json, [], []);
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
  var scripts = [];
  var transcludedNodes = [];
  var serializedHypermap = document.body.querySelector("pre").innerHTML;
  var jsonHypermap = JSON.parse(serializedHypermap);
  globalThis.hypermap = Hypermap.fromJSON(jsonHypermap, scripts, transcludedNodes);
  scripts.forEach(async (url) => {
    try {
      await import(url);
    } catch (err) {
      console.log(`Error importing script at ${url}`, err.message);
    }
  });
  transcludedNodes.forEach(async (node) => {
    await node.fetchTransclusion();
  });
  globalThis.serializedHypermap = () => {
    return JSON.parse(JSON.stringify(globalThis.hypermap));
  };
})();
