# VSN Builder v2.5.105 — Q.6.3.4 Stock Route Client/Server Boundary Hotfix

## Runtime error reproduced from user log
React Router/Vite rejected `app.stock-images.jsx` because the browser-rendered route component imported `STOCK_IMAGE_PROVIDERS` from `stock-image-integrations.server.js`. React Router can strip server dependencies used exclusively by `loader`, `action`, `middleware` or `headers`, but the provider constant was also required by the client component.

## Fix
- Added pure `app/config/stock-media.js` for provider/import arrays and public provider names.
- Stock Images, Stock Videos and Stock Audio now import their browser-used provider arrays from that shared config.
- `stock-image-integrations.server.js` imports/re-exports the same constants for server compatibility; secrets and credentials remain server-only.
- Added a K.3 stock-route boundary regression assertion plus Q6.3.4 dedicated audit.

## Data safety
No Prisma migration and no database data changes are required.

## Final QA
- Dedicated Q6.3.4 audit: 27/27 PASS
- Strengthened K.3 client/server boundary audit: 23/23 PASS
- Q6.3.3 regression: 89/89 PASS
- Full `npm run qa:release`: EXIT 0 (with `TERM=xterm` in the container QA shell)
- Parser QA: 325 JS/JSX files, 0 blocking syntax errors
- Capability coverage: 112/112
- Codebase health: 0 failures / 0 warnings
- Package integrity: PASS
- No Prisma migration; packaged SQLite is unchanged from v2.5.104.
