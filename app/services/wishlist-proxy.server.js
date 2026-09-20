import { syncCustomerWishlist, wishlistResponse } from "./wishlist.server.js";
import { jsonResponse as json } from "../storefront/responses.server.js";
import {
  boundedStorefrontText,
  STOREFRONT_WISHLIST_ITEMS_MAX_CHARS,
} from "../storefront/mutationRequest.server.js";

export function proxyWishlistCustomer(url) {
  const customerId = String(url.searchParams.get("logged_in_customer_id") || "").trim();
  return { signedCustomerId: customerId, customerData: { loggedIn: Boolean(customerId), id: customerId || null, name: String(url.searchParams.get("customerName") || "").trim(), email: String(url.searchParams.get("customerEmail") || "").trim() } };
}
export async function handleWishlistProxyAction({ db, session, formData, url }) {
  if (String(formData.get("_vsnAction") || "") !== "wishlist-sync") return null;
  const { signedCustomerId } = proxyWishlistCustomer(url);
  if (!signedCustomerId) return json({ ok:false, authenticated:false, error:"Customer login required for server wishlist sync." }, 401);
  let items=[]; try { items=JSON.parse(boundedStorefrontText(formData.get("items") || "[]", STOREFRONT_WISHLIST_ITEMS_MAX_CHARS, "Wishlist payload is too large.")); } catch (error) { if (error instanceof Response) return error; return json({ok:false,error:"Invalid wishlist payload."},400); }
  const requestedMode=String(formData.get("mode")||""); const mode=["merge","replace","clear"].includes(requestedMode)?requestedMode:"merge";
  const saved=await syncCustomerWishlist(db,{shop:session.shop,customerId:signedCustomerId,items,mode});
  return json({ok:true,authenticated:true,items:saved,count:saved.length,mode});
}
export async function handleWishlistProxyLoader({ db, admin, session, url, signedCustomerId }) {
  if (url.searchParams.get("wishlist") !== "1") return null;
  if (!signedCustomerId) return json({ok:true,authenticated:false,items:[],count:0,serverCount:0});
  return json(await wishlistResponse({db,admin,shop:session.shop,customerId:signedCustomerId,limit:url.searchParams.get("limit")}));
}
