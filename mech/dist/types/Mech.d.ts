export default class Mech {
    static launch(): Promise<Mech>;
    /** @param { { debug?: boolean } } options */
    newTab(options?: {
        debug?: boolean;
    }): Promise<Tab>;
    tabs(): Promise<puppeteer.Page[] | undefined>;
    close(): Promise<void>;
    #private;
}
export { Tab };
import Tab from './Tab.js';
import puppeteer from 'puppeteer';
//# sourceMappingURL=Mech.d.ts.map