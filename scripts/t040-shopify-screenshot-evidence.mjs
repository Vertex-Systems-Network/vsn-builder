// T040: source-level safety proof for ACTUAL on-disk Shopify listing PNGs.
// Filename existence is not image evidence. This checks only file bytes,
// dimensions and exact-content uniqueness, not that a Shopify UI was truly
// displayed; external Partner/merchant capture attestation remains mandatory.
import {createHash} from "node:crypto";
import {readFileSync,lstatSync,realpathSync} from "node:fs";
import {resolve,dirname} from "node:path";

const ROOT="docs/launch/evidence";
const PICTURE=/^docs\/launch\/evidence\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,90}\.png$/;
const HEADER=Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_BYTES=15*1024*1024;
const MIN_BYTES=24*1024;
const WIDTH=1600,HEIGHT=900;

export function inspectRealListingPng(path){
 if(typeof path!=="string" || !PICTURE.test(path))return null;
 try{
  const dir=realpathSync(ROOT);
  const resolved=resolve(path);
  // No path traversal, subdirectories or symlink-swaps to other repositories.
  if(dirname(resolved)!==dir)return null;
  const state=lstatSync(resolved);
  if(!state.isFile()||state.isSymbolicLink()||
     state.size<MIN_BYTES||state.size>MAX_BYTES)return null;
  const bytes=readFileSync(resolved);
  if(bytes.length!==state.size||!bytes.subarray(0,8).equals(HEADER)||
     bytes.readUInt32BE(8)!==13||
     bytes.toString("ascii",12,16)!=="IHDR" ||
     bytes.readUInt32BE(16)!==WIDTH ||bytes.readUInt32BE(20)!==HEIGHT ||
     bytes.readUInt32BE(bytes.length-12)!==0 ||
     bytes.toString("ascii",bytes.length-8,bytes.length-4)!=="IEND")
   return null;
  return Object.freeze({
   format:"png",width:WIDTH,height:HEIGHT,
   sha256:createHash("sha256").update(bytes).digest("hex"),
  });
 }catch{return null}
}

export function canonicalListingImagePath(path){
 return typeof path==="string"&&PICTURE.test(path);
}
