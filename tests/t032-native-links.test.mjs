import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {inspectNativeLinks,inspectPackagedNativeLinks} from "../scripts/t032-native-links-contract.mjs";

const base="extensions/vsn-page-builder-theme/blocks/";
const button=readFileSync(base+"native-button.liquid","utf8");
const social=readFileSync(base+"native-social-icons.liquid","utf8");
test("native button and social URLs are escaped and blanks are not live CTAs",()=>{
 const result=inspectPackagedNativeLinks();
 assert.deepEqual(result.errors,[]);
 assert.equal(result.hostedStorefrontVerified,false);
 assert.match(button,/target="_blank" rel="noopener noreferrer"/);
 assert.match(social,/<nav class="vsn-native-social" aria-label="Social media">/);
});
test("unsafe button URLs or labels and empty-link UI must fail",()=>{
 for(const [oldValue,replacement] of [
  ['href="{{ block.settings.url | escape }}"','href="{{ block.settings.url }}"'],
  ['{{ block.settings.text | escape }}','{{ block.settings.text }}'],
  ['{% if block.settings.url != blank %}','{% if true %}'],
  ['{% elsif request.design_mode %}','{% else %}'],
  ['rel="noopener noreferrer"','rel="nofollow"'],
  ['{{ block.shopify_attributes }}',''],
  ['data-vsn-native-instance="{{ block.id | escape }}"','data-vsn-native-instance="{{ block.id }}"'],
 ]){
  assert(button.includes(oldValue),oldValue);
  assert(inspectNativeLinks(button.replace(oldValue,replacement),social).length>0,oldValue);
 }
});
test("social link guards, escape, theme editor attributes and nav semantics are required",()=>{
 for(const [oldValue,replacement] of [
  ['href="{{ block.settings.instagram | escape }}"','href="{{ block.settings.instagram }}"'],
  ['href="{{ block.settings.facebook | escape }}"','href="{{ block.settings.facebook }}"'],
  ['href="{{ block.settings.tiktok | escape }}"','href="{{ block.settings.tiktok }}"'],
  ['{% if block.settings.instagram != blank %}','{% if true %}'],
  ['{% if block.settings.instagram != blank or block.settings.facebook != blank or block.settings.tiktok != blank %}','{% if true %}'],
  ['aria-label="Social media"',''],
  ['{{ block.shopify_attributes }}',''],
  ['data-vsn-native-instance="{{ block.id | escape }}"','data-vsn-native-instance="{{ block.id }}"'],
 ]){
  assert(social.includes(oldValue),oldValue);
  assert(inspectNativeLinks(button,social.replace(oldValue,replacement)).length>0,oldValue);
 }
});
test("invalid source and missing or altered Shopify schemas are rejected",()=>{
 assert.deepEqual(inspectNativeLinks(null,social),["Missing native link source"]);
 assert(inspectNativeLinks(button.replace('"target": "section"','"target": "unsupported"'),social).length>0);
 assert(inspectNativeLinks(button,social.replace("{% endschema %}","")).length>0);
});
