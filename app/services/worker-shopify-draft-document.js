// Shared structural safety contract for Shopify merchant editor JSON.
// Both write (before JSON.stringify) and read (after JSON.parse) MUST enforce
// the same limits so an accepted draft can always be rehydrated safely.
// Byte-size limits remain separately enforced by the existing HTTP/storage paths.
const MAX_TOP_LEVEL_NODES = 5000;
const MAX_ARRAY_ITEMS = 5000;
const MAX_DEPTH = 64;
const MAX_VISITED_VALUES = 100000;
const DENIED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function assertBoundedBuilderDraftDocument(elements) {
  if (!Array.isArray(elements) || elements.length > MAX_TOP_LEVEL_NODES)
    throw new TypeError("Invalid Builder editor document");
  const stack = [{value: elements, depth: 0}];
  // Avoid recursive traversal; a maliciously deep document must not overflow
  // the Worker stack before we can refuse it.
  const seen = new WeakSet();
  let visited = 0;
  while (stack.length > 0) {
    const {value, depth} = stack.pop();
    if (++visited > MAX_VISITED_VALUES || depth > MAX_DEPTH)
      throw new TypeError("Builder editor document exceeds structural limits");
    if (value === null || typeof value === "string" ||
        typeof value === "boolean") continue;
    if (typeof value === "number") {
      if (!Number.isFinite(value))
        throw new TypeError("Non-finite Builder editor value");
      continue;
    }
    if (typeof value !== "object")
      throw new TypeError("Unsupported Builder editor value");
    if (seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_ITEMS ||
          Object.keys(value).length !== value.length)
        throw new TypeError("Invalid Builder editor array");
      for (let i = value.length - 1; i >= 0; i--) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor || !Object.hasOwn(descriptor, "value"))
          throw new TypeError("Unsupported Builder editor array accessor");
        stack.push({value: descriptor.value, depth: depth + 1});
      }
      continue;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new TypeError("Invalid Builder editor object");
    const keys = Object.keys(value);
    if (keys.length > MAX_VISITED_VALUES - visited)
      throw new TypeError("Builder editor object exceeds structural limits");
    for (const key of keys) {
      if (DENIED_KEYS.has(key))
        throw new TypeError("Unsafe Builder editor object key");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value"))
        throw new TypeError("Unsupported Builder editor accessor");
      stack.push({value: descriptor.value, depth: depth + 1});
    }
  }
  return elements;
}
