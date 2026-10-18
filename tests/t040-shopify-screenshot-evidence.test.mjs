import test from "node:test";
import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import {deflateSync} from "node:zlib";
import {existsSync,mkdirSync,rmdirSync,writeFileSync,unlinkSync,symlinkSync} from "node:fs";
import {inspectRealListingPng} from "../scripts/t040-shopify-screenshot-evidence.mjs";

const ROOT="docs/launch/evidence";
const PNG=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Uint32Array.from({length:256},(_,i)=>{
 let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;
 return c>>>0;
});
function crc32(bytes){
 let crc=0xffffffff;
 for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);
 return (crc^0xffffffff)>>>0;
}
function chunk(type,data){
 const name=Buffer.from(type,"ascii");
 const len=Buffer.alloc(4);
 len.writeUInt32BE(data.length);
 const checksum=Buffer.alloc(4);
 checksum.writeUInt32BE(crc32(Buffer.concat([name,data])));
 return Buffer.concat([len,name,data,checksum]);
}
function makeSyntheticValidPng(width=1600,height=900){
 // Test fixture, NOT a captured app screenshot. Never leave it in the repo.
 const ihdr=Buffer.alloc(13);
 ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);
 ihdr[8]=8;ihdr[9]=2;
 const raw=Buffer.alloc((1+width*3)*height);
 let state=0x1234567;
 for(let row=0;row<height;row++){
  const off=row*(width*3+1);
  raw[off]=0; // Unfiltered, valid RGB scanline.
  for(let i=1;i<=width*3;i++){
   state=(Math.imul(state,1664525)+1013904223)>>>0;
   raw[off+i]=(state>>>24)&255;
  }
 }
 const body=deflateSync(raw,{level:1});
 return Buffer.concat([PNG,chunk("IHDR",ihdr),chunk("IDAT",body),chunk("IEND",Buffer.alloc(0))]);
}

// Insert real, CRC-correct PNG chunks; a valid PNG parser can accept these,
// but an App Store evidence image must not include private metadata.
const ihdrEnd=8+12+13;
function beforeImageData(bytes,name,data){
 return Buffer.concat([
  bytes.subarray(0,ihdrEnd),chunk(name,Buffer.from(data)),bytes.subarray(ihdrEnd),
 ]);
}
function afterImageData(bytes,name,data){
 const offset=bytes.length-12; // Original final IEND chunk
 return Buffer.concat([
  bytes.subarray(0,offset),chunk(name,Buffer.from(data)),bytes.subarray(offset),
 ]);
}
function fixture(bytes,fn){
 const created=!existsSync(ROOT);
 if(created)mkdirSync(ROOT,{recursive:true});
 const path=ROOT+"/ci-only-"+randomUUID()+".png";
 try{
  writeFileSync(path,bytes,{flag:"wx",mode:0o600});
  return fn(path);
 }finally{
  try{unlinkSync(path)}catch{}
  if(created)try{rmdirSync(ROOT)}catch{}
 }
}
test("actual valid 1600x900 decoded PNG bytes and SHA-256 are accepted as syntax-only metadata",()=>{
 const png=makeSyntheticValidPng();
 assert(png.length>24*1024&&png.length<15*1024*1024);
 fixture(png,path=>{
  const proof=inspectRealListingPng(path);
  assert.deepEqual(proof&&Object.keys(proof).sort(),["format","height","sha256","width"]);
  assert.equal(proof.format,"png");
  assert.equal(proof.width,1600);assert.equal(proof.height,900);
  assert.equal(proof.sha256,createHash("sha256").update(png).digest("hex"));
  assert.equal(Object.hasOwn(proof,"actual_shopify_ui"),false);
 });
});
test("corrupt CRC, malformed PNG and incorrect dimensions fail closed",()=>{
 const valid=makeSyntheticValidPng();
 fixture(valid,path=>{
  const altered=Buffer.from(valid);
  altered[29]^=0x01; // IHDR CRC corruption.
  writeFileSync(path,altered);
  assert.equal(inspectRealListingPng(path),null);
  const fake=Buffer.alloc(30000);
  PNG.copy(fake);fake.writeUInt32BE(13,8);
  fake.write("IHDR",12);fake.writeUInt32BE(1600,16);fake.writeUInt32BE(900,20);
  fake.write("IEND",fake.length-8);
  writeFileSync(path,fake);
  assert.equal(inspectRealListingPng(path),null,"magic-only forged PNG cannot pass");
  writeFileSync(path,makeSyntheticValidPng(1920,1080));
  assert.equal(inspectRealListingPng(path),null);
 });
});
test("CRC-correct hidden text, EXIF, private and animated chunks cannot ship as listing images",()=>{
 const base=makeSyntheticValidPng();
 const privateBytes=Buffer.from("Shopify-Token=secret; Merchant-Customer=42");
 const cases=[
  ["tEXt",privateBytes],
  ["zTXt",privateBytes],
  ["iTXt",privateBytes],
  ["eXIf",privateBytes],
  ["iCCP",privateBytes],
  ["acTL",Buffer.alloc(8)],
  ["fcTL",Buffer.alloc(26)],
  ["fdAT",privateBytes],
  ["vpAg",privateBytes],
  ["ABCD",privateBytes],
 ];
 fixture(base,path=>{
  for(const [name,data] of cases){
   const image=beforeImageData(base,name,data);
   writeFileSync(path,image);
   assert.equal(inspectRealListingPng(path),null,
    "PNG with CRC-correct "+name+" cannot be privacy-safe evidence");
   const trailing=afterImageData(base,name,data);
   writeFileSync(path,trailing);
   assert.equal(inspectRealListingPng(path),null,
    "no hidden chunk after IDAT: "+name);
  }
 });
});
test("strict validator accepts safe fixed-width color profile/pixel density chunks",()=>{
 const base=makeSyntheticValidPng();
 const cases=[
  ["sRGB",Buffer.from([0])],
  ["gAMA",Buffer.from([0,0,0,1])],
  ["cHRM",Buffer.alloc(32)],
  ["pHYs",Buffer.alloc(9)],
 ];
 fixture(base,path=>{
  for(const [name,data] of cases){
   const image=beforeImageData(base,name,data);
   writeFileSync(path,image);
   const got=inspectRealListingPng(path);
   assert(got,name+" must remain supported before IDAT");
   assert.equal(got.sha256,createHash("sha256").update(image).digest("hex"));
   writeFileSync(path,afterImageData(base,name,data));
   assert.equal(inspectRealListingPng(path),null,
    name+" after IDAT is forbidden to keep image payload contiguous");
  }
 });
});
test("duplicated and non-contiguous IDAT chunks fail closed",()=>{
 const base=makeSyntheticValidPng();
 fixture(base,path=>{
  const extra=chunk("IDAT",Buffer.from([0x00]));
  const broken=Buffer.concat([base.subarray(0,base.length-12),extra,
    base.subarray(base.length-12)]);
  writeFileSync(path,broken);
  assert.equal(inspectRealListingPng(path),null,
    "invalid inflated content appended to existing IDAT must be refused");
 });
});
test("a filesystem symlink to even a valid image is rejected",()=>{
 const image=makeSyntheticValidPng();
 const created=!existsSync(ROOT);
 if(created)mkdirSync(ROOT,{recursive:true});
 const normal=ROOT+"/ci-only-"+randomUUID()+".png";
 const alias=ROOT+"/ci-only-"+randomUUID()+".png";
 try{
  writeFileSync(normal,image,{flag:"wx"});
  symlinkSync(normal.split("/").at(-1),alias);
  assert(inspectRealListingPng(normal));
  assert.equal(inspectRealListingPng(alias),null);
 }finally{
  for(const file of [alias,normal])try{unlinkSync(file)}catch{}
  if(created)try{rmdirSync(ROOT)}catch{}
 }
});
