/**
 * Client/server-safe stock media provider contract.
 *
 * IMPORTANT: Keep pure constants in this module. Route components may import
 * these values because this file has no secrets, DB access, Shopify server
 * dependencies, or other .server imports.
 */
export const STOCK_PROVIDERS = Object.freeze(["unsplash", "pexels", "pixabay", "freesound", "shutterstock", "getty"]);
export const STOCK_IMAGE_PROVIDERS = Object.freeze(["unsplash", "pexels", "pixabay", "shutterstock", "getty"]);
export const STOCK_VIDEO_PROVIDERS = Object.freeze(["pexels", "pixabay", "shutterstock", "getty"]);
export const STOCK_AUDIO_PROVIDERS = Object.freeze(["freesound", "shutterstock"]);

export const STOCK_IMAGE_IMPORT_PROVIDERS = Object.freeze(["unsplash", "pexels", "pixabay"]);
export const STOCK_VIDEO_IMPORT_PROVIDERS = Object.freeze(["pexels", "pixabay"]);
export const STOCK_AUDIO_IMPORT_PROVIDERS = Object.freeze(["freesound"]);

export const STOCK_PROVIDER_NAMES = Object.freeze({
  unsplash: "Unsplash",
  pexels: "Pexels",
  pixabay: "Pixabay",
  freesound: "Freesound",
  shutterstock: "Shutterstock",
  getty: "Getty/iStock",
});
