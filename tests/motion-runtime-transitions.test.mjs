import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const file of ["extensions/vsn-page-builder-theme/assets/vsn-interactions.js", "app/builder/interactionRuntime.js"]) {
  test(`${file}: viewport triggers fire on transitions and animations do not stack`, () => {
    const source = readFileSync(file, "utf8");
    assert.match(source, /intersectionRect\.height\s*>=\s*vh\s*\*\s*threshold/, "tall elements must be able to enter");
    assert.match(source, /entered\s*&&\s*!was/, "viewport-enter fires only on the outside->inside transition");
    assert.match(source, /\.cancel\?\.\(\)/, "a re-trigger cancels the running animation");
  });
}
