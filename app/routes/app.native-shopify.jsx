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
  return <s-page heading="Native Shopify Bridge"><s-section><div className="space-y-4"><div className="rounded-xl border border-[#e3e3e3] bg-white p-4"><b>{data.bridge.blockCount} curated native blocks</b><p className="mt-1 text-sm text-[#6d7175]">Current theme: {data.bridge.currentTheme?.name || 'Not detected'}. Shopify currently permits up to {data.bridge.appBlockLimit} blocks per theme app extension.</p></div><div className="grid gap-3 md:grid-cols-2">{data.blocks.map((block)=><div key={block.handle} className="rounded-xl border border-[#e3e3e3] bg-white p-4"><div className="font-semibold">{block.label}</div><div className="mt-1 text-xs text-[#6d7175]">{block.handle} · widget gate: {block.widgetId}</div><div className="mt-3 flex flex-wrap gap-2">{block.links.map((link)=>link.url?<a key={link.template} className="rounded-md border px-2 py-1 text-xs" href={link.url} target="_top">Add to {link.template}</a>:null)}</div></div>)}</div><div className="rounded-xl border border-[#e3e3e3] bg-white p-4 text-sm"><b>Existing theme sections / third-party app blocks</b><p className="mt-1 text-[#6d7175]">Use an HTML widget → Render Mode → Shopify Theme Section Bridge and enter an existing section instance ID from the current JSON template. Shopify’s Section Rendering API returns that section’s rendered HTML, including app blocks already configured inside it.</p></div></div></s-section></s-page>;
}
