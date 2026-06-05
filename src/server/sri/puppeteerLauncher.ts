import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// puppeteer-extra mantiene un singleton; con cargar el plugin una vez basta para todo el proceso.
puppeteerExtra.use(StealthPlugin());

// Re-export como `puppeteer` para que los call sites cambien solo el import.
export const puppeteer = puppeteerExtra;
