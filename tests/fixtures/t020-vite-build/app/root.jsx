import { Outlet, Scripts } from "react-router";
export default function Root(){
  return <html lang="en"><head><meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body><Outlet /><Scripts /></body></html>;
}
export function ErrorBoundary(){return <main>CI route failure</main>;}
