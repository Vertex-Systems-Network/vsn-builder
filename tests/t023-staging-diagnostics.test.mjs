import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { redactDiagnostic, logStagingFailure, logStagingDenial, logStagingRequest, logStagingRouteError } from "../app/services/worker-diagnostics.js";
import { logCurrentStagingRouteError } from "../app/services/worker-route-error-diagnostics.server.js";
import { runWithWorkerRequestContext } from "../app/services/worker-request-context.server.js";

test("diagnostics redact DSNs, tokens, JWTs and long secrets",()=>{
  const out=redactDiagnostic("connect postgresql://u:p@ep-x.neon.tech/neondb shpat_abc123 napi_zzz eyJhbGciOiJIUzI1NiJ9.x.y "+"a".repeat(40));
  for(const leak of ["postgresql://","shpat_abc","napi_zzz","eyJhbGci","a".repeat(40)])
    assert(!out.includes(leak),leak);
});
test("staging auth-denial logs contain only fixed reason codes",()=>{
  const seen=[];const orig=console.warn;console.warn=m=>seen.push(m);
  try{
    logStagingDenial({APP_ENV:"production"},"paid-plan-not-verified");
    logStagingDenial({APP_ENV:"staging"},"paid-plan-not-verified");
    logStagingDenial({APP_ENV:"staging"},"secret-token-"+"x".repeat(48));
  }finally{console.warn=orig}
  assert.equal(seen.length,2);
  assert.deepEqual(JSON.parse(seen[0]),{vsn_diag:"admin-denial",reason:"paid-plan-not-verified"});
  assert.deepEqual(JSON.parse(seen[1]),{vsn_diag:"admin-denial",reason:"other"});
});
test("diagnostics log only on Staging",()=>{
  const seen=[];const orig=console.warn;console.warn=m=>seen.push(m);
  try{
    logStagingFailure({APP_ENV:"production"},"x",new Error("boom"));
    logStagingFailure({APP_ENV:"staging"},"x",new Error("boom"));
  }finally{console.warn=orig}
  assert.equal(seen.length,1);
  assert.deepEqual(JSON.parse(seen[0]),{vsn_diag:"x",error:"Error",code:"",message:"boom"});
});
test("handled React Router errors log only safe route, status, and Shopify error codes",()=>{
  const seen=[];const orig=console.warn;console.warn=m=>seen.push(m);
  try{
    logStagingRouteError({APP_ENV:"production"},"app",Object.assign(new Error("private token shpat_secret"),{code:"ACCESS_DENIED",status:401}));
    logStagingRouteError({APP_ENV:"staging"},"app",Object.assign(new Error("private token shpat_secret https://shop.example/?token=secret"),{
      name:"GraphqlQueryError",code:"admin-identity-gql-ACCESS_DENIED",response:{status:403,errors:[{extensions:{code:"ACCESS_DENIED"}},{extensions:{code:"SHOP_INACTIVE"}}]},
    }));
    logStagingRouteError({APP_ENV:"staging"},"app",Object.assign(new Error("private SDK message"),{
      code:"admin-identity-error",cause:{name:"GraphqlQueryError",body:{errors:{graphQLErrors:[
        {message:"private GraphQL message",extensions:{code:"ACCESS_DENIED"}},
        {message:"another private message",extensions:{code:"SHOP_INACTIVE"}},
      ]}}},
    }));
    logStagingRouteError({APP_ENV:"staging"},"app.pages",Object.assign(new Error("secret"),{code:"shpat_secret_123456789012345678901234567890",status:500}));
  }finally{console.warn=orig}
  assert.equal(seen.length,3);
  assert.deepEqual(JSON.parse(seen[0]),{
    vsn_diag:"route-error",route:"app",error:"GraphqlQueryError",
    code:"admin-identity-gql-ACCESS_DENIED",status:403,gqlCodes:["ACCESS_DENIED","SHOP_INACTIVE"],
  });
  assert.deepEqual(JSON.parse(seen[1]),{
    vsn_diag:"route-error",route:"app",error:"Error",
    code:"admin-identity-error",status:null,gqlCodes:["ACCESS_DENIED","SHOP_INACTIVE"],
  });
  assert.deepEqual(JSON.parse(seen[2]),{
    vsn_diag:"route-error",route:"app.pages",error:"Error",code:"",status:500,
  });
  assert(!seen.join(" ").includes("private"));
  assert(!seen.join(" ").includes("secret"));
  assert(!seen.join(" ").includes("shop.example"));
  assert(!seen.join(" ").includes("SDK message"));
  assert(!seen.join(" ").includes("GraphQL message"));
});
test("route diagnostics read only the request-scoped Staging tier and fail closed outside Worker context",()=>{
  const seen=[];const orig=console.warn;console.warn=m=>seen.push(m);
  try{
    logCurrentStagingRouteError("app",new Error("no Worker context"));
    runWithWorkerRequestContext({database:{},shopify:{},runtimeTier:"production"},()=>
      logCurrentStagingRouteError("app",new Error("Live failure")));
    runWithWorkerRequestContext({database:{},shopify:{},runtimeTier:"staging"},()=>
      logCurrentStagingRouteError("app",Object.assign(new Error("do not log this"),{code:"P2021"})));
  }finally{console.warn=orig}
  assert.equal(seen.length,1);
  assert.deepEqual(JSON.parse(seen[0]),{
    vsn_diag:"route-error",route:"app",error:"Error",code:"P2021",status:null,
  });
  assert(!seen.join(" ").includes("do not log"));
  assert(!seen.join(" ").includes("Live failure"));
});
test("Staging app breadcrumbs report status and content type without signed query or redirect URL",()=>{
  const seen=[];const orig=console.warn;console.warn=m=>seen.push(m);
  try{
    logStagingRequest({APP_ENV:"production"},new Request("https://worker.test/app?token=secret"),new Response("",{status:200}));
    logStagingRequest({APP_ENV:"staging"},new Request("https://worker.test/app?token=secret"),new Response("",{
      status:200,headers:{"content-type":"text/html; charset=utf-8",location:"redirect-target-secret"},
    }));
    logStagingRequest({APP_ENV:"staging"},new Request("https://worker.test/other?token=secret"),new Response("",{status:200}));
    logStagingRequest({APP_ENV:"staging"},new Request("https://worker.test/other?token=secret"),new Response("",{status:403}));
  }finally{console.warn=orig}
  assert.equal(seen.length,2);
  assert.deepEqual(JSON.parse(seen[0]),{
    vsn_req:"/app",method:"GET",status:200,
    contentType:"text/html; charset=utf-8",hasLocation:true,
    hasFrameAncestors:false,allowsShopifyAdminFrame:false,xFrameOptions:"none-or-other",
  });
  assert.deepEqual(JSON.parse(seen[1]),{vsn_req:"/other",method:"GET",status:403});
  assert(!seen.join(" ").includes("secret"));
  assert(!seen.join(" ").includes("redirect-target-secret"));
});
test("log tail workflow is manual, protected, Staging-only and read-only",()=>{
  const wf=readFileSync(".github/workflows/t023-staging-worker-tail.yml","utf8");
  assert.match(wf,/on:\n {2}workflow_dispatch:/);
  assert.match(wf,/github\.ref == 'refs\/heads\/development' && github\.ref_protected == true/);
  assert.match(wf,/environment: cloudflare-staging/);
  assert.match(wf,/wrangler" tail vsn-builder-staging/);
  assert.doesNotMatch(wf,/wrangler[^\n]*\b(deploy|secret|delete)\b|production|DATABASE_URL|NEON_API/);
});
