import { renderToReadableStream } from "react-dom/server.browser";
import { ServerRouter } from "react-router";

// Edge-safe fixture SSR. No Node streams; never handles merchant app traffic.
export default async function handleRequest(request,status,headers,routerContext){
  const body=await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {signal:request.signal},
  );
  const safeHeaders=new Headers(headers);
  safeHeaders.set("content-type","text/html; charset=utf-8");
  safeHeaders.set("cache-control","no-store");
  safeHeaders.set("content-security-policy","default-src 'none'; frame-ancestors 'none'");
  return new Response(body,{status,headers:safeHeaders});
}
