import {hostedEnvironmentInventory} from "./hosted-environment-inventory.js";
const target=process.argv.find(x=>x.startsWith("--target="))?.slice(9)||"";
const result=hostedEnvironmentInventory(process.env,target);
for(const e of result.errors)console.error("BLOCKED "+e);
if(!result.ok){console.error("Hosted "+(target||"unknown")+" secret inventory NOT VERIFIED. No deployment executed.");process.exitCode=1;}
else console.log("Hosted "+target+" secret inventory syntax PASS; Worker/runtime/merchant readiness NOT verified. No deployment executed.");
