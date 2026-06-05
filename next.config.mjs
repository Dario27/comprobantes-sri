/** @type {import('next').NextConfig} */
const nextConfig = {
  // Puppeteer y better-sqlite3 no deben empaquetarse: se resuelven en runtime
  // desde node_modules en el servidor Node. Funciona con Turbopack y Webpack.
  serverExternalPackages: [
    'puppeteer',
    'puppeteer-extra',
    'puppeteer-extra-plugin-stealth',
    'clone-deep',
    'merge-deep',
    'mixin-deep',
    'better-sqlite3'
  ],
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
