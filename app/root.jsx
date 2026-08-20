import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";
import { useEffect } from "react";
import appStylesHref from "./styles/app.css?url";
import GlobalInteractionLoader from "./components/ui/GlobalInteractionLoader";
import AppRuntimeBoundary from "./components/ui/AppRuntimeBoundary";

export const links = () => [{ rel: "stylesheet", href: appStylesHref }];

export const loader = () => ({ apiKey: process.env.SHOPIFY_API_KEY || "" });

function PolarisRuntime() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const existing = document.querySelector('script[data-vsn-polaris-runtime="true"]');
    if (existing) return undefined;

    const script = document.createElement("script");
    script.src = "https://cdn.shopify.com/shopifycloud/polaris.js";
    script.async = true;
    script.dataset.vsnPolarisRuntime = "true";
    document.head.appendChild(script);

    return () => {
      // Keep the runtime mounted across client-side route transitions. Removing
      // it would unregister/partially reset Shopify web components.
    };
  }, []);

  return null;
}

export default function App() {
  const { apiKey } = useLoaderData();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="shopify-api-key" content={apiKey} />
        <Meta />
        <Links />
      </head>
      <body>
        <GlobalInteractionLoader />
        <AppRuntimeBoundary><Outlet /></AppRuntimeBoundary>
        <ScrollRestoration />
        <Scripts />
        <PolarisRuntime />
      </body>
    </html>
  );
}
