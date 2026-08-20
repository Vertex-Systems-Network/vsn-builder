export function evaluateCommerceConditionRule(name, rule = {}, ctx = {}) {
  const product = ctx?.product || {};
  const collection = ctx?.collection || {};
  const value = String(rule?.value || '').toLowerCase();
  if (name === 'product-available') return product.availableForSale === true;
  if (name === 'product-sold-out') return product.availableForSale === false;
  if (name === 'product-vendor') return String(product.vendor || '').toLowerCase() === value;
  if (name === 'product-type') return String(product.productType || '').toLowerCase() === value;
  if (name === 'product-tag') return (product.tags || []).some((tag) => String(tag).toLowerCase() === value);
  if (name === 'collection-handle') return String(collection.handle || '').toLowerCase() === value;
  if (name === 'cart-empty') return Number(ctx?.cart?.itemCount || 0) <= 0;
  if (name === 'cart-has-items') return Number(ctx?.cart?.itemCount || 0) > 0;
  if (name === 'cart-items-min') return Number(ctx?.cart?.itemCount || 0) >= Math.max(0, Number(rule.value || 0));
  if (name === 'product-inventory-min') return Number(product.inventoryQuantity || 0) >= Number(rule.value || 0);
  if (name === 'product-inventory-max') return Number(product.inventoryQuantity || 0) <= Number(rule.value || 0);
  return null;
}
