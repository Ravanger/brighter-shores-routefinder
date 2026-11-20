import test from "node:test";
import assert from "node:assert/strict";
import GPS from "./gps.js";
import pathfinder from "./pathfinder.js";
import { buildRouteGeometry } from "./routeMapData.js";
import { cityShortcuts, crimeDens, edges } from "./nodes.js";
import { nodePositions } from "./nodePositions.js";

// Teleport times in seconds (game ticks / 600, brighteratlas.com).
const TELEPORT_SECONDS = {
  Cellar: 6.17,
  Sewer: 3.67,
  Painting: 5.17,
  Manhole: 8.1,
  Trapdoor: 8.17,
};

test("cityShortcut edges match the cityShortcuts table", () => {
  const shortcutEdges = edges.filter((edge) => edge.cityShortcut);
  assert.equal(shortcutEdges.length, cityShortcuts.length);
  for (const shortcut of cityShortcuts) {
    const edge = shortcutEdges.find((e) => e.cityShortcut === shortcut.name);
    assert.ok(edge, `no edge for ${shortcut.name}`);
    assert.equal(edge.detectiveMilestone, shortcut.milestone);
    // The weight is the teleport itself.
    assert.equal(edge.weight, TELEPORT_SECONDS[shortcut.name]);
    // The table's endpoint nodes are the edge's nodes, in edge order.
    assert.deepEqual(
      shortcut.endpoints.map((endpoint) => endpoint.node),
      edge.nodes,
    );
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

  // Its distance is the previous step's plus the teleport. Tolerance: a
  // difference of accumulated floating-point sums does not always round
  // identically to the direct sum.
  const buy = unlocked.actions.find((action) => action.type === "buy");
  assert.ok(
    Math.abs(
      shortcuts[0].distance - buy.distance - TELEPORT_SECONDS.Cellar,
    ) < 1e-9,
  );

  const locked = pathfinder.findBestBounties(["MEAT_WRAP"], [], 4, false, true);
  assert.equal(
    locked.actions.filter((action) => action.type === "shortcut").length,
    0,
  );
  assert.ok(locked.distance > unlocked.distance);
});

// A route from Victor T Cyclops (8) to the Vase Stall (85): at milestone 5
// the leg 120 -> 137 is the Cellar teleport, drawn as a shortcut segment
// between the two endpoints' positions; at milestone 4 it is not.
test("shortcut legs are drawn as shortcut segments on the route map", () => {
  const actions = [
    { type: "buy", item: "X", location: "Victor T Cyclops" },
    { type: "sell", item: "X", location: "Vase Stall" },
  ];
  const from = nodePositions[120]; // Cellar spot in Unicorn Farm
  const to = nodePositions[137]; // Cellar spot in Snag Alley

  const hasShortcutSegment = (geometry) =>
    geometry.segments.some(
      (segment) =>
        segment.kind === "shortcut" &&
        segment.name === "Cellar" &&
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

  assert.ok(hasShortcutSegment(buildRouteGeometry(actions, 5, false, false)));
  assert.ok(!hasShortcutSegment(buildRouteGeometry(actions, 4, false, false)));

  // Jump stops: the Outskirts portal stone on the way out, plus both Cellar
  // teleport spots (neither endpoint is a stop here).
  assert.deepEqual(buildRouteGeometry(actions, 5, false, false).jumps, [
    { kind: "teleport", name: "Crenopolis Outskirts", x: 293, y: 61 },
    {
      kind: "shortcut",
      name: "Cellar",
      x: nodePositions[120][0],
      y: nodePositions[120][1],
    },
    {
      kind: "shortcut",
      name: "Cellar",
      x: nodePositions[137][0],
      y: nodePositions[137][1],
    },
  ]);
});

// A route that crosses the Cellar without stopping at either endpoint draws
// the crossing as a shortcut segment between the two teleport spots, with
// the walks connecting to and from them (the walk out passes through the
// Cheese Shop on its way to the Unicorn Farm spot). The portal stone jump
// earlier in the same route is a different kind of jump: "teleport", not
// "shortcut". Below the milestone (4) the same route never touches a spot.
test("a crossing route connects to and from the teleport spots", () => {
  const actions = [
    { type: "buy", item: "X", location: "Victor T Cyclops" },
    { type: "sell", item: "X", location: "Greengrocers" },
  ];

  // Only the stops, portal stones and Cellar spots, and no street paths:
  // the waypoints between them are left out so the expected segments stay
  // short.
  const positions = Object.fromEntries(
    [8, 21, 53, 54, 84, 103, 120, 137].map((node) => [
      node,
      nodePositions[node],
    ]),
  );
  const unlocked = buildRouteGeometry(
    actions,
    5,
    false,
    false,
    positions,
    undefined,
    [],
    {},
  );
  assert.deepEqual(unlocked.segments, [
    {
      points: [
        [436, 42],
        [293, 61],
      ],
      kind: "teleport",
      name: "Crenopolis Outskirts",
    },
    {
      points: [
        [293, 61],
        nodePositions[8],
        nodePositions[84],
        nodePositions[120],
      ],
      kind: "walk",
      name: null,
    },
    {
      points: [nodePositions[120], nodePositions[137]],
      kind: "shortcut",
      name: "Cellar",
    },
    {
      points: [nodePositions[137], nodePositions[21]],
      kind: "walk",
      name: null,
    },
  ]);

  // Jump stops: the portal stone plus both Cellar teleport spots.
  assert.deepEqual(unlocked.jumps, [
    { kind: "teleport", name: "Crenopolis Outskirts", x: 293, y: 61 },
    {
      kind: "shortcut",
      name: "Cellar",
      x: nodePositions[120][0],
      y: nodePositions[120][1],
    },
    {
      kind: "shortcut",
      name: "Cellar",
      x: nodePositions[137][0],
      y: nodePositions[137][1],
    },
  ]);

  const locked = buildRouteGeometry(actions, 4, false, false);
  const touches = (segments, point) =>
    segments.some((segment) =>
      segment.points.some(([x, y]) => x === point[0] && y === point[1]),
    );
  assert.ok(!touches(locked.segments, nodePositions[120]));
  assert.ok(!touches(locked.segments, nodePositions[137]));
});

test("no ordinary walk passes through a shortcut spot", () => {
  const spots = new Set(
    cityShortcuts.flatMap((shortcut) =>
      shortcut.endpoints.map((endpoint) => endpoint.node),
    ),
  );
  const nodes = [...new Set(edges.flatMap((edge) => edge.nodes))].filter(
    (node) => !spots.has(node),
  );
  const gps = new GPS(9, true, crimeDens.map((den) => den.key));
  for (const from of nodes) {
    for (const to of nodes) {
      if (from === to) {
        continue;
      }
      const { path } = gps.distance(from, to);
      for (let i = 1; i < path.length - 1; ++i) {
        assert.ok(
          !spots.has(path[i]) || spots.has(path[i - 1]) || spots.has(path[i + 1]),
          `${from} -> ${to} walks through spot ${path[i]}: ${path.join(",")}`,
        );
      }
    }
  }
});
