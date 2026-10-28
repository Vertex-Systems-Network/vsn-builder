import { createContext } from "react";

// Global Style Kit colours available to every colour picker in the editor.
export const GlobalColorsContext = createContext([]);

const TOKEN = /^var\(--vsn-color-([a-z0-9-]+)(?:\s*,\s*(#[0-9a-f]{3,8}))?\)$/i;
export function parseGlobalColorToken(value) {
  const match = TOKEN.exec(String(value || "").trim());
  return match ? { id: match[1], fallback: match[2] || "" } : null;
}
