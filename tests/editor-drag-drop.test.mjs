import test from "node:test";
import assert from "node:assert/strict";
import { dragDropEffect, draggingSection, markDragType } from "../app/components/editor/dnd/dragPreview.js";

const transfer = (types) => ({ dataTransfer: { types } });

test("moving an existing node answers 'move' even though getData is empty during dragover", () => {
  assert.equal(dragDropEffect(transfer(["text/plain", "vsndragkind", "vsnnodeid"])), "move");
  assert.equal(dragDropEffect(transfer(["text/plain", "elementtype", "vsndragkind"])), "copy");
});

test("a dragged section is recognised from its data type", () => {
  const set = [];
  markDragType({ dataTransfer: { setData: (type) => set.push(type) } }, "Section");
  assert.deepEqual(set, ["application/x-vsn-type-section"]);
  assert.equal(draggingSection(transfer(["vsnnodeid", "application/x-vsn-type-section"])), true);
  assert.equal(draggingSection(transfer(["vsnnodeid", "application/x-vsn-type-heading"])), false);
});
