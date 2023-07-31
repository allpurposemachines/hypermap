export default class Tab extends EventEmitter {
    /** @param { import('puppeteer').Page } page */
    constructor(page: import('puppeteer').Page);
    /** @type { import('puppeteer').Page } */
    page: import('puppeteer').Page;
    /** @type { Hypermap | null } */
    hypermap: Hypermap | null;
    /**
     * @param { string } url
     * @param { import('puppeteer').WaitForOptions= } options
    */
    goto(url: string, options?: import('puppeteer').WaitForOptions | undefined): Promise<void>;
    url(): string;
    syncData(): Promise<void>;
}
import { EventEmitter } from 'node:events';
import Hypermap from './Hypermap.js';
//# sourceMappingURL=Tab.d.ts.map