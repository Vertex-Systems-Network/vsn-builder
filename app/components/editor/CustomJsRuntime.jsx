import { useEffect, useMemo } from "react";
import { collectCustomJsEntries, customJsSignature } from "../../builder/customCode.js";

function findElement(root, id) {
  if (!root || !id) return null;
  return [...root.querySelectorAll?.("[data-vsn-id]") || []].find((element) => element.getAttribute("data-vsn-id") === id) || null;
}

export default function CustomJsRuntime({ rootRef, elements = [], mode = "editor" }) {
  const scripts = useMemo(() => collectCustomJsEntries(elements), [elements]);
  const signature = useMemo(() => customJsSignature(scripts), [scripts]);

  useEffect(() => {
    if (!scripts.length) return undefined;
    let disposed = false;
    let cleanups = [];

    const timer = window.setTimeout(() => {
      if (disposed) return;
      const root = rootRef?.current;
      if (!root) return;

      cleanups = scripts.map(({ id, code }) => {
        const element = findElement(root, id);
        if (!element) return null;
        try {
          element.removeAttribute("data-vsn-js-error");
          const runner = new Function(
            "element",
            "document",
            "window",
            `"use strict";\n${code}\n//# sourceURL=vsn-custom-js-${String(id).replace(/[^a-zA-Z0-9_-]/g, "-")}.js`,
          );
          const cleanup = runner(element, document, window);
          element.setAttribute("data-vsn-js-ready", "1");
          return typeof cleanup === "function" ? cleanup : null;
        } catch (error) {
          element.setAttribute("data-vsn-js-error", "1");
          // Syntax errors are common while the merchant is still typing. Keep the
          // editor usable and surface only runtime failures as a warning.
          if (!(error instanceof SyntaxError)) console.warn(`VSN custom JS (${mode}) failed for ${id}:`, error);
          return null;
        }
      }).filter(Boolean);
    }, 300);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      cleanups.forEach((cleanup) => {
        try { cleanup(); } catch {}
      });
    };
  }, [rootRef, signature, mode]);

  return null;
}

export { collectCustomJsEntries as collectCustomJs };
