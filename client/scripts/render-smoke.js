/**
 * Client render smoke test.
 *
 * Server-renders every page component and fails on any runtime error
 * (missing hook import, undefined component, bad context usage, ...).
 * This is the guard against the class of crash that only shows up in the
 * browser console, where a whole page becomes unusable.
 *
 * Run with: npm run smoke:render   (from the client folder)
 */
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, '..');
const toPath = (value) => value.replace(/^\/([A-Za-z]:)/, '$1');

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
  location: { pathname: '/' },
  addEventListener() {},
  removeEventListener() {},
};

const bodyStub = {
  nodeType: 1,
  appendChild() {},
  removeChild() {},
  insertBefore() {},
  ownerDocument: null,
  style: {},
};
globalThis.document = {
  documentElement: { lang: 'en', dir: 'ltr' },
  body: bodyStub,
  createElement: () => ({ nodeType: 1, style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }),
  addEventListener() {},
  removeEventListener() {},
};
bodyStub.ownerDocument = globalThis.document;
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: {} }) });

// React warns about useLayoutEffect during server rendering; it is expected here.
const realError = console.error;
console.error = (...args) => {
  if (String(args[0] || '').includes('useLayoutEffect does nothing on the server')) return;
  realError(...args);
};

const vite = await createServer({
  root: toPath(clientRoot),
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
  resolve: {
    alias: {
      // Portals are unsupported by the server renderer; the shim renders them inline.
      'react-dom': toPath(join(here, 'react-dom-ssr-shim.js')),
    },
  },
});

const PAGES = [
  'Dashboard', 'Products', 'Categories', 'StockIn', 'StockOut', 'StockPositions', 'StockLedger',
  'Sales', 'Purchases', 'Customers', 'Suppliers', 'Expenses', 'Payments', 'Reports',
  'Branches', 'Users', 'Settings', 'Audit', 'Login',
];

const { MemoryRouter } = await import('react-router-dom');
const { I18nProvider } = await vite.ssrLoadModule('/src/i18n/index.jsx');
const { ToastProvider } = await vite.ssrLoadModule('/src/components/ui/Toast.jsx');
const { AuthProvider } = await vite.ssrLoadModule('/src/context/AuthContext.jsx');
const { AppProvider } = await vite.ssrLoadModule('/src/context/AppContext.jsx');

const wrap = (element) =>
  React.createElement(
    MemoryRouter,
    null,
    React.createElement(
      I18nProvider,
      null,
      React.createElement(
        ToastProvider,
        null,
        React.createElement(AuthProvider, null, React.createElement(AppProvider, null, element))
      )
    )
  );

let failed = 0;
for (const name of PAGES) {
  try {
    const mod = await vite.ssrLoadModule(`/src/pages/${name}.jsx`);
    const html = renderToString(wrap(React.createElement(mod.default)));
    // eslint-disable-next-line no-console
    console.log(`  [PASS] ${name}.jsx rendered (${html.length} chars)`);
  } catch (error) {
    failed++;
    // eslint-disable-next-line no-console
    console.error(`  [FAIL] ${name}.jsx -> ${error.message.split('\n')[0]}`);
  }
}

await vite.close();

// eslint-disable-next-line no-console
console.log(failed ? `\n${failed} page(s) failed to render` : '\nAll pages render without runtime errors.');
process.exit(failed ? 1 : 0);
