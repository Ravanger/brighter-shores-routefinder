import test from "node:test";
import assert from "node:assert/strict";
import { edgePaths } from "./edgePaths.js";
import { edges } from "./nodes.js";

// A walk edge without a stored path is drawn as a straight line between its
// nodes: regenerate edgePaths.js after adding or moving a node.
test("every walk edge has a street path", () => {
  for (const edge of edges) {
    if (edge.cityShortcut) {
      continue;
    }
    const path = edgePaths[edge.nodes.join("-")];
    assert.ok(Array.isArray(path), `edge ${edge.nodes.join("-")} has no path`);
    for (const point of path) {
      assert.ok(
        point.length === 2 && point.every(Number.isFinite),
        `edge ${edge.nodes.join("-")} has a bad point`,
      );
    }
  }
});

test("City Shortcut teleports have no street path", () => {
  for (const edge of edges.filter((e) => e.cityShortcut)) {
    assert.equal(edgePaths[edge.nodes.join("-")], undefined);
  }
});

test("edgePaths has no stale keys", () => {
  const valid = new Set(
    edges.filter((e) => !e.cityShortcut).map((e) => e.nodes.join("-")),
  );
  for (const key of Object.keys(edgePaths)) {
    assert.ok(valid.has(key), `edgePaths has a stale path for ${key}`);
  }
});
