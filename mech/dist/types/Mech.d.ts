export namespace Mech {
    let debug: boolean;
    let debugRequestHandler: null;
    let browser: puppeteer.Browser | null;
    /** @param { string } url */
    function open(url: string): Promise<Tab>;
    function tabs(): Promise<puppeteer.Page[] | undefined>;
    function close(): Promise<void>;
}
import { Tab } from './Tab.js';
import puppeteer from 'puppeteer';
export { Tab };
//# sourceMappingURL=Mech.d.ts.map