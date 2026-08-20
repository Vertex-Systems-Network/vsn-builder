const strict = process.env.NODE_ENV === 'production' || process.env.VSN_RELEASE_STRICT === '1';
const required = ['VSN_E2E_STORE_URL', 'VSN_E2E_EDITOR_URL', 'VSN_E2E_PAGE_ID'];
const missing = required.filter((key) => !String(process.env[key] || '').trim());
if (missing.length) {
  const message = `Live Shopify E2E not configured: ${missing.join(', ')}`;
  if (strict) { console.error(`FAIL ${message}`); process.exit(1); }
  console.log(`WARN ${message}`);
} else console.log('PASS live Shopify E2E environment configured.');
