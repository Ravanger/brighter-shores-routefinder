import test from "node:test";
import assert from "node:assert/strict";
import GPS from "./gps.js";
import pathfinder from "./pathfinder.js";
import { buildRouteGeometry } from "./routeMapData.js";
import { cityShortcuts, edges } from "./nodes.js";
import { nodePositions } from "./nodePositions.js";

test("cityShortcut edges match the cityShortcuts table", () => {
  const shortcutEdges = edges.filter((edge) => edge.cityShortcut);
  assert.equal(shortcutEdges.length, cityShortcuts.length);
  for (const shortcut of cityShortcuts) {
    const edge = shortcutEdges.find((e) => e.cityShortcut === shortcut.name);
    assert.ok(edge, `no edge for ${shortcut.name}`);
    assert.equal(edge.detectiveMilestone, shortcut.milestone);
    // The weight is the ~2s teleport itself.
    assert.equal(edge.weight, 2);
  }
});

// Locked at milestone m-1 (the endpoints are still connected by a longer
// walk), a direct two-second hop once unlocked at m.
test("cityShortcut edges are gated by the Detective milestone in GPS", () => {
  for (const edge of edges.filter((e) => e.cityShortcut)) {
    const [a, b] = edge.nodes;
    const m = edge.detectiveMilestone;

    const locked = new GPS(m - 1, false).distance(a, b);
    assert.notDeepEqual(locked.path, [a, b]);
    assert.ok(locked.distance > edge.weight);

    const unlocked = new GPS(m, false).distance(a, b);
    assert.deepEqual(unlocked, { distance: edge.weight, path: [a, b] });
  }
});

// MEAT_WRAP at milestone 5 (Cellar unlocked): the route crosses the Cellar
// shortcut and it is its own line item between the buy and the sell. Below
// the milestone (4) no shortcut step appears and the route is longer.
test("pathfinder labels a shortcut crossing as its own travel step", () => {
  const unlocked = pathfinder.findBestBounties(
    ["MEAT_WRAP"],
    [],
    5,
    false,
    true,
  );
  const shortcuts = unlocked.actions.filter(
    (action) => action.type === "shortcut",
  );
  assert.equal(shortcuts.length, 1);
  assert.equal(shortcuts[0].location, "Cellar");

  // The step sits between the buy and the sell in path order.
  const types = unlocked.actions.map((action) => action.type);
  assert.ok(types.indexOf("shortcut") > types.indexOf("buy"));
  assert.ok(types.indexOf("shortcut") < types.indexOf("sell"));

  // Its distance is the previous step's plus the 2s teleport. Tolerance: a
  // difference of accumulated floating-point sums does not always round
  // identically to the direct sum.
  const buy = unlocked.actions.find((action) => action.type === "buy");
  assert.ok(Math.abs(shortcuts[0].distance - buy.distance - 2) < 1e-9);

  const locked = pathfinder.findBestBounties(["MEAT_WRAP"], [], 4, false, true);
  assert.equal(
    locked.actions.filter((action) => action.type === "shortcut").length,
    0,
  );
  assert.ok(locked.distance > unlocked.distance);
});

// A buy at the Cheese Shop (node 84) from the Guild board (103): at
// milestone 5 the leg 107 -> 84 is the Cellar teleport, drawn as a dashed
// segment between the two endpoints' positions; at milestone 4 it is not.
test("shortcut legs are drawn as dashed segments on the route map", () => {
  const actions = [{ type: "buy", item: "X", location: "Cheese Shop" }];
  const from = nodePositions[107]; // Cellar spot in Snag Alley
  const to = nodePositions[84]; // Cheese Shop

  const hasShortcutSegment = (geometry) =>
    geometry.segments.some(
      (segment) =>
        segment.dashed &&
        segment.points.length === 2 &&
        ((segment.points[0][0] === from[0] &&
          segment.points[0][1] === from[1] &&
          segment.points[1][0] === to[0] &&
          segment.points[1][1] === to[1]) ||
          (segment.points[0][0] === to[0] &&
            segment.points[0][1] === to[1] &&
            segment.points[1][0] === from[0] &&
            segment.points[1][1] === from[1])),
    );

  assert.ok(hasShortcutSegment(buildRouteGeometry(actions, 5, false, true)));
  assert.ok(!hasShortcutSegment(buildRouteGeometry(actions, 4, false, true)));
});
