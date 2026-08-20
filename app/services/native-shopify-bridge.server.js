export const NATIVE_APP_BLOCKS = [
  ['native-vsn-section','VSN section','section'],['native-heading','Heading','heading'],['native-text','Text','text'],['native-button','Button','button'],['native-image','Image','image'],['native-video','Video','video'],['native-divider','Divider','divider'],['native-spacer','Spacer','spacer'],['native-banner','Banner','banner'],['native-icon-box','Icon box','icon-box'],['native-image-box','Image box','image-box'],['native-accordion','Accordion','accordion'],['native-social-icons','Social links','social-icons'],['native-product-title','Product title','product-title'],['native-product-price','Product price','product-price'],['native-product-image','Product image','product-image'],['native-add-to-cart','Add to cart','product-add-to-cart'],['native-breadcrumbs','Breadcrumbs','breadcrumbs'],['native-collection-title','Collection title','collection-title'],['native-collection-image','Collection image','collection-image'],['native-announcement','Announcement','announcement-bar'],['native-trust-badges','Trust badges','trust-badges'],['native-countdown','Countdown','countdown'],['native-newsletter','Newsletter','newsletter-form'],
].map(([handle,label,widgetId])=>({handle,label,widgetId}));

export function nativeAppBlockDeepLink({ shop, apiKey, handle, template = 'index', target = 'newAppsSection' }) {
  const url = new URL(`https://${shop}/admin/themes/current/editor`);
  url.searchParams.set('template', template || 'index');
  url.searchParams.set('addAppBlockId', `${apiKey}/${handle}`);
  url.searchParams.set('target', target || 'newAppsSection');
  return url.toString();
}

export async function inspectNativeShopifyBridge(admin) {
  let themes = [];
  try {
    const response = await admin.graphql(`#graphql\nquery VsnNativeThemes { themes(first: 20) { nodes { id name role } } }`);
    const json = await response.json();
    themes = json.data?.themes?.nodes || [];
  } catch {}
  const current = themes.find((theme) => theme.role === 'MAIN') || themes[0] || null;
  return { currentTheme: current, themes, blockCount: NATIVE_APP_BLOCKS.length, appBlockLimit: 30 };
}
