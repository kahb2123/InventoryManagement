/**
 * End-to-end API smoke test.
 * Boots the API in-process against the in-memory MongoDB fallback, seeds data,
 * then exercises every endpoint the React client calls.
 *
 * Run with: npm run smoke   (from the server folder)
 */
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { seedDatabase } from '../src/utils/seed.js';
import { REPORT_LIST } from '../src/services/reports.service.js';

let baseUrl = '';
let token = '';
const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  // eslint-disable-next-line no-console
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function call(method, url, body) {
  const options = { method, headers: {} };
  if (token) options.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${url}`, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body: json };
}

function expectOk(name, result, validate) {
  const ok = result.status >= 200 && result.status < 300 && (validate ? validate(result.body) : true);
  record(name, ok, ok ? '' : `status ${result.status} ${JSON.stringify(result.body).slice(0, 220)}`);
  return ok;
}

async function main() {
  await connectDatabase();
  await seedDatabase({ force: true });

  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  // ---------------------------------------------------------------- health
  const health = await call('GET', '/health');
  expectOk('GET /health', health, (b) => b?.data?.status === 'ok');

  const setupStatus = await call('GET', '/auth/setup-status');
  expectOk('GET /auth/setup-status', setupStatus, (b) => b?.data?.needsSetup === false);

  // ------------------------------------------------------------------ auth
  const badLogin = await call('POST', '/auth/login', { email: 'owner@buildstock.et', password: 'wrong-password' });
  record('POST /auth/login rejects a bad password', badLogin.status === 401, `status ${badLogin.status}`);

  const login = await call('POST', '/auth/login', {
    email: 'owner@buildstock.et',
    password: 'BuildStock@2024',
  });
  if (!expectOk('POST /auth/login', login, (b) => Boolean(b?.data?.token))) {
    throw new Error('Cannot continue without a session token');
  }
  token = login.body.data.token;

  const me = await call('GET', '/auth/me');
  expectOk('GET /auth/me', me, (b) => b?.data?.role === 'owner' && Array.isArray(b?.data?.permissions));

  // ------------------------------------------------------------ reference
  expectOk('GET /branches', await call('GET', '/branches'), (b) => Array.isArray(b?.data) && b.data.length > 0);
  expectOk('GET /products/categories', await call('GET', '/products/categories'), (b) => Array.isArray(b?.data));
  expectOk('GET /products/units', await call('GET', '/products/units'), (b) => Array.isArray(b?.data));
  expectOk('GET /products', await call('GET', '/products?limit=5'), (b) => Array.isArray(b?.data) && b.meta.total > 0);
  expectOk('GET /customers', await call('GET', '/customers?limit=5'), (b) => Array.isArray(b?.data) && b.meta.total > 0);
  expectOk('GET /suppliers', await call('GET', '/suppliers?limit=5'), (b) => Array.isArray(b?.data) && b.data[0]?.balance !== undefined);
  expectOk('GET /settings/branding', await call('GET', '/settings/branding'), (b) => Array.isArray(b?.data?.defaultPaymentMethods));
  expectOk('GET /settings', await call('GET', '/settings'), (b) => Array.isArray(b?.data?.branches));
  expectOk('GET /dashboard', await call('GET', '/dashboard'), (b) => Boolean(b?.data));
  expectOk('GET /dashboard/branches', await call('GET', '/dashboard/branches'), (b) => Array.isArray(b?.data));

  // --------------------------------------------------------------- parties
  const supplierList = await call('GET', '/suppliers?limit=1');
  const supplierId = supplierList.body?.data?.[0]?._id;
  expectOk('GET /suppliers/:id/statement', await call('GET', `/suppliers/${supplierId}/statement`), (b) => Array.isArray(b?.data?.lines));

  const customerList = await call('GET', '/customers?limit=1');
  const customerId = customerList.body?.data?.[0]?._id;
  expectOk('GET /customers/:id/statement', await call('GET', `/customers/${customerId}/statement`), (b) => Array.isArray(b?.data?.lines));

  // ----------------------------------------------------------------- stock
  expectOk('GET /stock/positions', await call('GET', '/stock/positions'), (b) => Array.isArray(b?.data));
  expectOk('GET /stock/ledger', await call('GET', '/stock/ledger?limit=5'), (b) => Array.isArray(b?.data) && b.meta.total > 0);
  expectOk('GET /stock/transfers', await call('GET', '/stock/transfers'), (b) => Array.isArray(b?.data));

  const productList = await call('GET', '/products?limit=1');
  const product = productList.body?.data?.[0];
  const branchList = await call('GET', '/branches');
  const branch = branchList.body?.data?.[0];

  const stockIn = await call('POST', '/stock/in', {
    product: product._id,
    branch: branch._id,
    quantity: 5,
    unitCost: 100,
    source: 'manual',
    notes: 'smoke test stock in',
  });
  expectOk('POST /stock/in', stockIn, (b) => Boolean(b?.data?.movement));

  const stockOut = await call('POST', '/stock/out', {
    product: product._id,
    branch: branch._id,
    quantity: 2,
    type: 'damage',
    reason: 'damaged',
    notes: 'smoke test stock out',
  });
  expectOk('POST /stock/out', stockOut, (b) => Boolean(b?.data?.movement));

  // ---------------------------------------------------------------- sales
  const sale = await call('POST', '/sales', {
    customer: customerId,
    branch: branch._id,
    items: [{ product: product._id, quantity: 2, unitPrice: 150, unit: product.unit?._id || product.unit }],
    paymentMethod: 'cash',
    paidAmount: 100,
    clientKey: `smoke-sale-${Date.now()}`,
  });
  expectOk('POST /sales', sale, (b) => Boolean(b?.data?._id));

  const salesList = await call('GET', '/sales?limit=5');
  expectOk('GET /sales', salesList, (b) => Array.isArray(b?.data) && b.meta.total > 0);
  const saleId = salesList.body?.data?.[0]?._id;
  expectOk('GET /sales/:id', await call('GET', `/sales/${saleId}`), (b) => Boolean(b?.data));

  // ------------------------------------------------------------- purchases
  const purchase = await call('POST', '/purchases', {
    supplier: supplierId,
    branch: branch._id,
    expectedDate: new Date().toISOString(),
    items: [{ product: product._id, quantity: 10, unitCost: 90 }],
    clientKey: `smoke-po-${Date.now()}`,
  });
  expectOk('POST /purchases', purchase, (b) => Boolean(b?.data?._id));
  const purchaseId = purchase.body?.data?._id;

  expectOk(
    'POST /purchases/:id/receive',
    await call('POST', `/purchases/${purchaseId}/receive`, {
      items: [{ product: product._id, quantity: 10, unitCost: 90 }],
    }),
    (b) => Boolean(b?.data?._id)
  );

  expectOk('GET /purchases', await call('GET', '/purchases?limit=5'), (b) => Array.isArray(b?.data) && b.meta.total > 0);

  // ---------------------------------------------------------------- money
  const expense = await call('POST', '/expenses', {
    category: 'transportation',
    amount: 1500,
    date: new Date().toISOString(),
    description: 'smoke test expense',
    paymentMethod: 'cash',
    paidTo: 'Driver',
    branch: branch._id,
  });
  expectOk('POST /expenses', expense, (b) => Boolean(b?.data?._id));
  expectOk('GET /expenses', await call('GET', '/expenses?limit=5'), (b) => Array.isArray(b?.data) && b.summary);
  expectOk('GET /expenses/categories', await call('GET', '/expenses/categories'), (b) => Array.isArray(b?.data));

  const receipt = await call('POST', '/payments', {
    type: 'customer_receipt',
    party: customerId,
    amount: 250,
    method: 'cash',
    date: new Date().toISOString(),
  });
  expectOk('POST /payments (receipt)', receipt, (b) => Boolean(b?.data?._id));

  const supplierPayment = await call('POST', '/payments', {
    type: 'supplier_payment',
    party: supplierId,
    amount: 300,
    method: 'bank_transfer',
    date: new Date().toISOString(),
  });
  expectOk('POST /payments (supplier)', supplierPayment, (b) => Boolean(b?.data?._id));

  expectOk('GET /payments', await call('GET', '/payments?limit=5'), (b) => Array.isArray(b?.data) && Array.isArray(b?.summary));

  // -------------------------------------------------------------- reports
  expectOk('GET /reports (catalog)', await call('GET', '/reports'), (b) => Array.isArray(b?.data) && b.data.length > 0);
  for (const report of REPORT_LIST) {
    const params = new URLSearchParams({ from: '2000-01-01', to: '2100-01-01' });
    if (report.key === 'period-sales' || report.key === 'gross-profit') params.set('groupBy', 'day');
    const result = await call('GET', `/reports/${report.key}?${params.toString()}`);
    expectOk(
      `GET /reports/${report.key}`,
      result,
      (b) => Array.isArray(b?.data?.rows) && Array.isArray(b?.data?.columns)
    );
  }

  // ---------------------------------------------------------------- audit
  expectOk('GET /audit', await call('GET', '/audit?limit=5'), (b) => Array.isArray(b?.data) && b.meta.total > 0);

  // ---------------------------------------------------------------- users
  expectOk('GET /users/roles', await call('GET', '/users/roles'), (b) => Array.isArray(b?.data) && b.data.length === 5);
  expectOk('GET /users', await call('GET', '/users'), (b) => Array.isArray(b?.data));

  const newUser = await call('POST', '/users', {
    name: 'Smoke Test',
    email: `smoke-${Date.now()}@buildstock.et`,
    password: 'SmokeTest@2024',
    role: 'storekeeper',
  });
  expectOk('POST /users', newUser, (b) => Boolean(b?.data?._id));
  if (newUser.body?.data?._id) {
    expectOk(
      'PATCH /users/:id',
      await call('PATCH', `/users/${newUser.body.data._id}`, { phone: '+251900000000' }),
      (b) => b?.data?.phone === '+251900000000'
    );
    expectOk('DELETE /users/:id', await call('DELETE', `/users/${newUser.body.data._id}`), (b) => b?.success === true);
  }

  // ----------------------------------------------------------- permissions
  const clerkLogin = await call('POST', '/auth/login', {
    email: 'clerk@buildstock.et',
    password: 'BuildStock@2024',
  });
  if (clerkLogin.status === 200 && clerkLogin.body?.data?.token) {
    const ownerToken = token;
    token = clerkLogin.body.data.token;
    const forbidden = await call('GET', '/reports/net-profit');
    record('Sales clerk is blocked from financial reports', forbidden.status === 403, `status ${forbidden.status}`);
    const allowed = await call('GET', '/sales');
    record('Sales clerk can list sales', allowed.status === 200, `status ${allowed.status}`);
    token = ownerToken;
  } else {
    record('Sales clerk login available', false, `status ${clerkLogin.status}`);
  }

  // ------------------------------------------------------------------ done
  const failed = results.filter((r) => !r.ok);
  // eslint-disable-next-line no-console
  console.log(`\n  ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    // eslint-disable-next-line no-console
    console.log('  Failures:');
    for (const f of failed) console.log(`   - ${f.name}: ${f.detail}`);
  }

  server.close();
  await disconnectDatabase();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error('[smoke] crashed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
