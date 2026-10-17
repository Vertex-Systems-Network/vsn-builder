// T040: source-level safety proof for ACTUAL on-disk Shopify listing PNGs.
// Filename existence is not image evidence. This checks only file bytes,
// dimensions and exact-content uniqueness, not that a Shopify UI was truly
// displayed; external Partner/merchant capture attestation remains mandatory.
import {createHash} from "node:crypto";
import {inflateSync} from "node:zlib";
import {readFileSync,lstatSync,realpathSync} from "node:fs";
import {resolve,dirname} from "node:path";

const ROOT="docs/launch/evidence";
const PICTURE=/^docs\/launch\/evidence\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,90}\.png$/;
const HEADER=Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_BYTES=15*1024*1024;
const MIN_BYTES=24*1024;
const WIDTH=1600,HEIGHT=900;
const crcTable=Uint32Array.from({length:256},(_,i)=>{
 let c=i;
 for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;
 return c>>>0;
});
function pngCrc(data){
 let value=0xffffffff;
 for(const byte of data)value=crcTable[(value^byte)&255]^(value>>>8);
 return (value^0xffffffff)>>>0;
}
// Decode the PNG container, CRCs and bounded deflate stream. A renamed file
// with only a PNG magic/header/footer is NOT a real valid image.
function authenticPngStructure(bytes){
 let offset=8,first=true,sawEnd=false;
 const deflate=[];
 let total=0,channels=0;
 while(offset+12<=bytes.length){
  const len=bytes.readUInt32BE(offset);
  if(len>MAX_BYTES || offset+12+len>bytes.length)return false;
  const name=bytes.toString("ascii",offset+4,offset+8);
  const block=bytes.subarray(offset+4,offset+8+len);
  if(pngCrc(block)!==bytes.readUInt32BE(offset+8+len))return false;
  if(first){
   if(name!=="IHDR"||len!==13 ||
      bytes.readUInt32BE(offset+8)!==WIDTH ||
      bytes.readUInt32BE(offset+12)!==HEIGHT ||
      bytes[offset+16]!==8 || ![2,6].includes(bytes[offset+17]) ||
      bytes[offset+18]!==0 || bytes[offset+19]!==0 ||
      bytes[offset+20]!==0)return false;
   channels=bytes[offset+17]===2?3:4;
   first=false;
  }else if(name==="IDAT"){
   total+=len;
   if(total>MAX_BYTES)return false;
   deflate.push(bytes.subarray(offset+8,offset+8+len));
  }else if(name==="IEND"){
   if(len!==0||offset+12!==bytes.length){return false}
   sawEnd=true;
   break;
  }else if(name==="IHDR"||!/^[-a-zA-Z]{4}$/.test(name)){
   return false;
  }
  offset+=12+len;
 }
 if(!sawEnd||!deflate.length)return false;
 try{
  const rowBytes=1+WIDTH*channels;
  const expected=HEIGHT*rowBytes;
  const scanlines=inflateSync(Buffer.concat(deflate),{maxOutputLength:expected});
  if(scanlines.byteLength!==expected)return false;
  for(let row=0;row<HEIGHT;row++){
   if(scanlines[row*rowBytes]>4)return false;
  }
  return true;
 }catch{return false}
}


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
     !authenticPngStructure(bytes))return null;
  return Object.freeze({
   format:"png",width:WIDTH,height:HEIGHT,
   sha256:createHash("sha256").update(bytes).digest("hex"),
  });
 }catch{return null}
}

export function canonicalListingImagePath(path){
 return typeof path==="string"&&PICTURE.test(path);
}
