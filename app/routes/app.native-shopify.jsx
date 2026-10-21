import { useLoaderData } from 'react-router';
import { authenticate } from '../shopify.server';
import { inspectNativeShopifyBridge, NATIVE_APP_BLOCKS, nativeAppBlockDeepLink } from '../services/native-shopify-bridge.server.js';

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const bridge = await inspectNativeShopifyBridge(admin);
  const apiKey = process.env.SHOPIFY_API_KEY || '';
  return { shop: session.shop, apiKey, bridge, blocks: NATIVE_APP_BLOCKS.map((block)=>({ ...block, links: ['index','product','collection','page'].map((template)=>({ template, url: apiKey ? nativeAppBlockDeepLink({ shop: session.shop, apiKey, handle: block.handle, template }) : '' })) })) };
}
export default function NativeShopify(){
  const data=useLoaderData();
  return <s-page heading="Native Shopify Bridge"><s-stack direction="block" gap="base"><s-section heading={`${data.bridge.blockCount} curated native blocks`}><s-paragraph color="subdued">Current theme: {data.bridge.currentTheme?.name || 'Not detected'}. Shopify currently permits up to {data.bridge.appBlockLimit} blocks per theme app extension.</s-paragraph></s-section><s-grid gridTemplateColumns="@container (inline-size > 600px) 1fr 1fr, 1fr" gap="base">{data.blocks.map((block)=><s-section key={block.handle} heading={block.label}><s-stack direction="block" gap="small-200"><s-text color="subdued">{block.handle} · widget gate: {block.widgetId}</s-text><s-stack direction="inline" gap="small-200">{block.links.map((link)=>link.url?<s-button key={link.template} href={link.url} target="_top">Add to {link.template}</s-button>:null)}</s-stack></s-stack></s-section>)}</s-grid><s-section heading="Existing theme sections / third-party app blocks"><s-paragraph color="subdued">Use an HTML widget → Render Mode → Shopify Theme Section Bridge and enter an existing section instance ID from the current JSON template. Shopify’s Section Rendering API returns that section’s rendered HTML, including app blocks already configured inside it.</s-paragraph></s-section></s-stack></s-page>;
}
