// Native Cloudflare Vite integration builds the client under dist/client.
// React Router v7's server-manifest lookup must use the SAME build directory.
// Opt in ONLY for the locked T020 CI experiment; the regular VSN Builder
// Local/Dev and Node SSR default build output remains ./build.
const ci = process.env.CI === "true" &&
  process.env.VSN_CLOUDFLARE_NATIVE_CI === "1" &&
  process.env.APP_ENV === "development" &&
  process.env.NODE_ENV === "test";
const stagingWorker = process.env.APP_ENV === "staging" &&
  process.env.VSN_STAGING_FULL_APP_BUILD === "1";
const productionWorker = process.env.APP_ENV === "production" &&
  process.env.VSN_PRODUCTION_FULL_APP_BUILD === "1";
export default {
  ssr: true,
  buildDirectory: ci || stagingWorker || productionWorker ? "dist" : "build",
};
