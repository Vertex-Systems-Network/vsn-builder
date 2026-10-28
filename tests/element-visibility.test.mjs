import test from "node:test";
import assert from "node:assert/strict";
import { hideOnCss, isHiddenOnDevice, normalizeHideOn } from "../app/builder/visibility.js";

test("per-device visibility normalises and matches devices", () => {
  assert.deepEqual(normalizeHideOn({}), { desktop: false, tablet: false, mobile: false });
  const node = { id: "a1", meta: { hideOn: { mobile: true } } };
  assert.equal(isHiddenOnDevice(node, "mobile"), true);
  assert.equal(isHiddenOnDevice(node, "desktop"), false);
  assert.equal(isHiddenOnDevice({ meta: { hidden: true } }, "desktop"), true);
});

test("hide-on CSS targets only the flagged breakpoints and sanitises ids", () => {
  const css = hideOnCss('x"}<b', { hideOn: { mobile: true, desktop: true } });
  assert.match(css, /max-width:749px/);
  assert.match(css, /min-width:990px/);
  assert.doesNotMatch(css, /750px/);
  assert.doesNotMatch(css, /[<"}]b/);
  assert.equal(hideOnCss("a", {}), "");
});
