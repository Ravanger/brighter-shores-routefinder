import test from "node:test";
import assert from "node:assert/strict";
import {
  assignStopNumbers,
  buildRouteGeometry,
  buildRouteSteps,
  flattenRoutePoints,
  formatStopNumbers,
} from "./routeMapData.js";
import { expressBountyBoard } from "./nodes.js";
import { nodePositions } from "./nodePositions.js";

// Buy at the Toy Stall, sell at the Cheese Shop, then return to the board.
// The teleport action in the middle is an intermediate step, not a stop.
const sampleActions = [
  { type: "buy", item: "CARROTS", location: "Toy Stall", distance: 10 },
  { type: "teleport", location: "Crenopolis Market", distance: 18 },
  { type: "sell", item: "CARROTS", location: "Cheese Shop", distance: 30 },
  { type: "Return", location: "Guild Bounty Board", distance: 60 },
];

// Only the sample route's stops, boards and portal stones: the waypoints
// between them are left out so the expected segments stay short.
const stopPositions = Object.fromEntries(
  [36, 53, 54, 59, 84, 103].map((node) => [node, nodePositions[node]]),
);

test("builds numbered stops, the start marker and solid/dashed segments", () => {
  const geometry = buildRouteGeometry(
    sampleActions,
    0,
    false,
    true,
    stopPositions,
  );

  assert.ok(geometry);
  assert.deepEqual(geometry.start, {
    node: 103,
    label: "Guild Bounty Board",
    x: 436,
    y: 42,
  });
  assert.deepEqual(geometry.stops, [
    { node: 36, label: "Toy Stall", number: 1, x: 414, y: 93 },
    { node: 84, label: "Cheese Shop", number: 2, x: 246, y: 49 },
  ]);

  // Legs: board -> Toy Stall (walk), Toy Stall -> Cheese Shop (teleport via
  // the Outskirts portal stone), Cheese Shop -> board (teleport via the
  // Market portal stone). Jump legs carry the portal stone's name for the
  // map's hover tooltip; walk legs carry null.
  assert.deepEqual(geometry.segments, [
    { points: [[436, 42], [414, 93]], kind: "walk", name: null },
    {
      points: [[414, 93], [293, 61]],
      kind: "teleport",
      name: "Crenopolis Outskirts",
    },
    { points: [[293, 61], [246, 49]], kind: "walk", name: null },
    {
      points: [[246, 49], [443, 61]],
      kind: "teleport",
      name: "Crenopolis Market",
    },
    { points: [[443, 61], [436, 42]], kind: "walk", name: null },
  ]);

  // Jump stops: one dot per portal stone the route teleports through.
  assert.deepEqual(geometry.jumps, [
    { kind: "teleport", name: "Crenopolis Outskirts", x: 293, y: 61 },
    { kind: "teleport", name: "Crenopolis Market", x: 443, y: 61 },
  ]);

  // Bounding box of the positioned nodes plus 24 units of padding.
  assert.deepEqual(geometry.viewBox, [222, 18, 245, 99]);
});

test("starts at the Express Bounty Board when it is the board", () => {
  const geometry = buildRouteGeometry(
    sampleActions,
    0,
    false,
    true,
    stopPositions,
    expressBountyBoard,
  );

  assert.ok(geometry);
  assert.deepEqual(geometry.start, {
    node: 59,
    label: "Express Bounty Board",
    x: 429,
    y: 50,
  });

  // The first leg leaves the Express board and the last returns to it; the
  // middle legs are unchanged from the Guild board route.
  assert.deepEqual(geometry.segments, [
    { points: [[429, 50], [414, 93]], kind: "walk", name: null },
    {
      points: [[414, 93], [293, 61]],
      kind: "teleport",
      name: "Crenopolis Outskirts",
    },
    { points: [[293, 61], [246, 49]], kind: "walk", name: null },
    {
      points: [[246, 49], [443, 61]],
      kind: "teleport",
      name: "Crenopolis Market",
    },
    { points: [[443, 61], [429, 50]], kind: "walk", name: null },
  ]);

  // Same jump stops as the Guild board route.
  assert.deepEqual(geometry.jumps, [
    { kind: "teleport", name: "Crenopolis Outskirts", x: 293, y: 61 },
    { kind: "teleport", name: "Crenopolis Market", x: 443, y: 61 },
  ]);

  const route = buildRouteSteps(
    geometry,
    sampleActions,
    true,
    stopPositions,
  );
  const ret = route.steps.find((step) => step.type === "Return");
  assert.deepEqual(ret, {
    number: null,
    type: "Return",
    item: null,
    location: "Express Bounty Board",
    node: 59,
    x: 429,
    y: 50,
    latLng: [50, 429],
    teleport: true,
    portal: "Crenopolis Market",
    pointIndex: 5,
  });
});

test("skips actions at unknown locations instead of crashing", () => {
  const actions = [
    { type: "buy", item: "CARROTS", location: "Toy Stall", distance: 10 },
    { type: "buy", item: "SOAP", location: "Nowhere", distance: 20 },
    { type: "sell", item: "CARROTS", location: "Cheese Shop", distance: 30 },
  ];

  const geometry = buildRouteGeometry(actions, 0, false, false);

  assert.ok(geometry);
  assert.deepEqual(
    geometry.stops.map((stop) => [stop.number, stop.label]),
    [
      [1, "Toy Stall"],
      [2, "Cheese Shop"],
    ],
  );
});

test("returns null when there are no buy/sell stops", () => {
  assert.equal(buildRouteGeometry([], 0, false, true), null);
  assert.equal(
    buildRouteGeometry(
      [{ type: "Return", location: "Guild Bounty Board", distance: 5 }],
      0,
      false,
      true,
    ),
    null,
  );
});

test("returns null when no stop has a position", () => {
  assert.equal(buildRouteGeometry(sampleActions, 0, false, true, {}), null);
});

// A route that walks through a raided Muggers den marks the room it passes:
// the walk line bends through the room's own node (here, the Four Winds
// Backroom) and the dot sits at its position. With no den enabled the same
// route takes the long way and marks nothing.
test("den passages walked through are marked as dots on the map", () => {
  const actions = [
    { type: "buy", item: "X", location: "Victor T Cyclops" },
    { type: "sell", item: "X", location: "Clock Stall" },
  ];

  const raided = buildRouteGeometry(
    actions,
    9,
    true,
    false,
    undefined,
    undefined,
    ["MUGGERS"],
  );
  assert.deepEqual(raided.dens, [
    { name: "Muggers", room: "Four Winds Backroom", x: 355.01, y: 59.09 },
  ]);

  assert.deepEqual(buildRouteGeometry(actions, 9, true, false).dens, []);
});

test("flattens segments to ordered points, carrying kind and name", () => {
  const geometry = buildRouteGeometry(
    sampleActions,
    0,
    false,
    true,
    stopPositions,
  );

  assert.deepEqual(flattenRoutePoints(geometry.segments), [
    { x: 436, y: 42, kind: "walk", name: null },
    { x: 414, y: 93, kind: "walk", name: null },
    { x: 293, y: 61, kind: "teleport", name: "Crenopolis Outskirts" },
    { x: 246, y: 49, kind: "walk", name: null },
    { x: 443, y: 61, kind: "teleport", name: "Crenopolis Market" },
    { x: 436, y: 42, kind: "walk", name: null },
  ]);
});

test("flattenRoutePoints skips duplicate join points and empty segments", () => {
  assert.deepEqual(
    flattenRoutePoints([
      { points: [[1, 2]], kind: "walk", name: null },
      { points: [], kind: "teleport", name: "Crenopolis Market" },
      {
        points: [
          [1, 2],
          [3, 4],
        ],
        kind: "walk",
        name: null,
      },
    ]),
    [
      { x: 1, y: 2, kind: "walk", name: null },
      { x: 3, y: 4, kind: "walk", name: null },
    ],
  );
  assert.deepEqual(flattenRoutePoints([]), []);
});

test("builds steps, places, route points and bounds for the map", () => {
  const geometry = buildRouteGeometry(
    sampleActions,
    0,
    false,
    true,
    stopPositions,
  );
  const route = buildRouteSteps(
    geometry,
    sampleActions,
    true,
    stopPositions,
  );

  assert.ok(route);
  assert.deepEqual(route.steps, [
    {
      number: 1,
      type: "buy",
      item: "CARROTS",
      location: "Toy Stall",
      node: 36,
      x: 414,
      y: 93,
      latLng: [93, 414],
      teleport: false,
      portal: null,
      pointIndex: 1,
    },
    {
      number: 2,
      type: "sell",
      item: "CARROTS",
      location: "Cheese Shop",
      node: 84,
      x: 246,
      y: 49,
      latLng: [49, 246],
      teleport: true,
      portal: "Crenopolis Outskirts",
      pointIndex: 3,
    },
    {
      number: null,
      type: "Return",
      item: null,
      location: "Guild Bounty Board",
      node: 103,
      x: 436,
      y: 42,
      latLng: [42, 436],
      teleport: true,
      portal: "Crenopolis Market",
      pointIndex: 5,
    },
  ]);
  assert.deepEqual(route.places, [
    { node: 36, label: "Toy Stall", latLng: [93, 414], numbers: [1] },
    { node: 84, label: "Cheese Shop", latLng: [49, 246], numbers: [2] },
  ]);
  assert.deepEqual(route.routePoints, [
    { x: 436, y: 42, kind: "walk", name: null, latLng: [42, 436] },
    { x: 414, y: 93, kind: "walk", name: null, latLng: [93, 414] },
    {
      x: 293,
      y: 61,
      kind: "teleport",
      name: "Crenopolis Outskirts",
      latLng: [61, 293],
    },
    { x: 246, y: 49, kind: "walk", name: null, latLng: [49, 246] },
    {
      x: 443,
      y: 61,
      kind: "teleport",
      name: "Crenopolis Market",
      latLng: [61, 443],
    },
    { x: 436, y: 42, kind: "walk", name: null, latLng: [42, 436] },
  ]);
  assert.deepEqual(route.bounds, [
    [42, 246],
    [93, 443],
  ]);
});

test("buildRouteSteps returns null without geometry", () => {
  assert.equal(buildRouteSteps(null, sampleActions, true), null);
});

test("groups duplicate stops into one place with all their numbers", () => {
  const actions = [
    { type: "buy", item: "CARROTS", location: "Toy Stall", distance: 10 },
    { type: "buy", item: "SOAP", location: "Toy Stall", distance: 20 },
    { type: "sell", item: "CARROTS", location: "Cheese Shop", distance: 30 },
  ];
  const geometry = buildRouteGeometry(actions, 0, false, false);
  const route = buildRouteSteps(geometry, actions, false);

  assert.deepEqual(route.places, [
    { node: 36, label: "Toy Stall", latLng: [93, 414], numbers: [1, 2] },
    { node: 84, label: "Cheese Shop", latLng: [49, 246], numbers: [3] },
  ]);
});

test("formats stop numbers as ranges", () => {
  assert.equal(formatStopNumbers([1]), "1");
  assert.equal(formatStopNumbers([9, 10, 11]), "9–11");
  assert.equal(formatStopNumbers([4, 7]), "4, 7");
  assert.equal(formatStopNumbers([4, 5, 7]), "4–5, 7");
});

// The actions list and the map must number stops from the same ordering:
// buy/sell actions 1..N in action order; teleport and Return show none.
test("assigns stop numbers to buy/sell actions only, in action order", () => {
  assert.deepEqual(assignStopNumbers(sampleActions), [1, null, 2, null]);
});

test("teleport, den and Return steps get no number and consume none", () => {
  const actions = [
    { type: "buy", item: "CARROTS", location: "Toy Stall", distance: 10 },
    { type: "den", location: "Smugglers", distance: 15 },
    { type: "teleport", location: "Crenopolis Market", distance: 23 },
    { type: "sell", item: "CARROTS", location: "Cheese Shop", distance: 30 },
    { type: "Return", location: "Guild Bounty Board", distance: 60 },
  ];
  assert.deepEqual(assignStopNumbers(actions), [1, null, null, 2, null]);
});

test("list numbering matches the map steps for the same actions", () => {
  const geometry = buildRouteGeometry(
    sampleActions,
    0,
    false,
    true,
    stopPositions,
  );
  const route = buildRouteSteps(
    geometry,
    sampleActions,
    true,
    stopPositions,
  );
  const mapNumbers = route.steps
    .filter((step) => step.number !== null)
    .map((step) => step.number);

  assert.deepEqual(
    assignStopNumbers(sampleActions).filter((n) => n !== null),
    mapNumbers,
  );
});

test("actions at unknown or unpositioned locations get no number and consume none", () => {
  const actions = [
    { type: "buy", item: "CARROTS", location: "Nowhere Market", distance: 5 },
    { type: "buy", item: "SOAP", location: "Cheese Shop", distance: 10 },
    { type: "buy", item: "CARROTS", location: "Toy Stall", distance: 20 },
  ];
  // Default positions: the unknown market gets no number, the rest follow.
  assert.deepEqual(assignStopNumbers(actions), [null, 1, 2]);

  // Only the Toy Stall has a position: the Cheese Shop is dropped from the
  // map too, and must not leave a gap in the numbering.
  const sparse = { 36: [414, 93] };
  assert.deepEqual(assignStopNumbers(actions, sparse), [null, null, 1]);
  const geometry = buildRouteGeometry(actions, 0, false, false, sparse);
  assert.deepEqual(
    geometry.stops.map((stop) => stop.number),
    [1],
  );
});

// The reported bug: Hermar's -> Soap Shop -> Fortunehold Farm walks through
// Murkwell Lane and Dawkin Lane twice. With every waypoint positioned, both
// legs follow the doorways and never touch the Sewer spot in Sludge Street.
test("walks follow the doorways and never bend to an unused shortcut spot", () => {
  const actions = [
    { type: "buy", item: "X", location: "Hermar's Homeware" },
    { type: "buy", item: "Y", location: "Soap Shop" },
    { type: "sell", item: "X", location: "Fortunehold Farm" },
  ];
  const geometry = buildRouteGeometry(actions, 9, true, false);
  const points = geometry.segments.flatMap((segment) => segment.points);
  const touches = (node) =>
    points.some(
      ([x, y]) => x === nodePositions[node][0] && y === nodePositions[node][1],
    );
  assert.ok(touches(79), "Dawkin Lane / Murkwell Lane door");
  assert.ok(touches(80), "Dawkin Lane / Soap Shop door");
  assert.ok(!touches(139), "Sewer spot in Sludge Street");
  assert.deepEqual(
    geometry.jumps.filter((jump) => jump.kind === "shortcut"),
    [],
  );
});

// A walk between two positioned nodes runs through the street path stored
// for their edge, in either direction: 79 -> 80 is on the way from Hermar's
// to the Soap Shop.
test("walk legs follow the street path stored for each edge", () => {
  const actions = [
    { type: "buy", item: "X", location: "Hermar's Homeware" },
    { type: "sell", item: "X", location: "Soap Shop" },
  ];
  const pointsWith = (paths) =>
    buildRouteGeometry(actions, 9, true, false, undefined, undefined, [], paths)
      .segments.flatMap((segment) => segment.points)
      .map(([x, y]) => `${x},${y}`);
  const from = nodePositions[79].join(",");
  const to = nodePositions[80].join(",");

  const forward = pointsWith({ "79-80": [[1, 2], [3, 4]] });
  const start = forward.indexOf(from);
  assert.deepEqual(forward.slice(start, start + 4), [from, "1,2", "3,4", to]);

  const reversed = pointsWith({ "80-79": [[1, 2], [3, 4]] });
  const back = reversed.indexOf(from);
  assert.deepEqual(reversed.slice(back, back + 4), [from, "3,4", "1,2", to]);
});

// A directed edge (nodes.js marks it one-way) still draws its stored street
// path, in the direction it is walked: Fortunehold Farm -> Butcher's Stall
// crosses the one-way West Gate edges 15 -> 16.
test("directed edges draw their street path in the walked direction", () => {
  const actions = [
    { type: "buy", item: "X", location: "Fortunehold Farm" },
    { type: "sell", item: "X", location: "Butcher's Stall" },
  ];
  const points = buildRouteGeometry(
    actions,
    9,
    true,
    false,
    undefined,
    undefined,
    [],
    { "15-16": [[7, 8]] },
  )
    .segments.flatMap((segment) => segment.points)
    .map(([x, y]) => `${x},${y}`);
  const at = nodePositions[15].join(",");
  const i = points.indexOf(at);
  assert.ok(i !== -1, "route passes through node 15");
  assert.deepEqual(points.slice(i, i + 3), [at, "7,8", nodePositions[16].join(",")]);
});

// A walk through a raided den bends through the room's own node and carries
// the street path on each half of the passage: Victor T Cyclops -> Clock Stall
// crosses the Muggers Four Winds Backroom (132) via 107 -> 132 -> 108.
test("den passages draw street points on both sides of the room", () => {
  const actions = [
    { type: "buy", item: "X", location: "Victor T Cyclops" },
    { type: "sell", item: "X", location: "Clock Stall" },
  ];
  const geometry = buildRouteGeometry(
    actions,
    9,
    true,
    false,
    undefined,
    undefined,
    ["MUGGERS"],
    { "107-132": [[1, 1]], "108-132": [[2, 2]] },
  );
  assert.deepEqual(geometry.dens, [
    { name: "Muggers", room: "Four Winds Backroom", x: 355.01, y: 59.09 },
  ]);
  const points = geometry.segments
    .flatMap((segment) => segment.points)
    .map(([x, y]) => `${x},${y}`);
  const room = nodePositions[132].join(",");
  const i = points.indexOf(room);
  assert.ok(i !== -1, "route bends through the den room");
  assert.deepEqual(points.slice(i - 2, i + 3), [
    nodePositions[107].join(","),
    "1,1",
    room,
    "2,2",
    nodePositions[108].join(","),
  ]);
});

// A walk leg beside a node that has no position is drawn as a straight line:
// the street path for the edge into it is dropped, so the segment spans the
// gap from the previous positioned node to the next.
test("walk legs skip street points beside an unpositioned node", () => {
  const actions = [
    { type: "buy", item: "X", location: "Fortunehold Farm" },
    { type: "sell", item: "X", location: "Butcher's Stall" },
  ];
  const paths = { "1-9": [[7, 8]] };
  const flat = (geometry) =>
    geometry.segments.flatMap((segment) => segment.points).map(([x, y]) => `${x},${y}`);

  const positioned = buildRouteGeometry(actions, 9, true, false, undefined, undefined, [], paths);
  assert.ok(flat(positioned).includes("7,8"), "with node 9 positioned its street point is drawn");

  const sparse = { ...nodePositions };
  delete sparse[9]; // node 9 is on the route but has no position
  const unpositioned = buildRouteGeometry(actions, 9, true, false, sparse, undefined, undefined, paths);
  const points = flat(unpositioned);
  assert.ok(!points.includes("7,8"), "no street point beside an unpositioned node");
  // The leg runs straight from node 1 (before the gap) to node 14 (after it).
  const from = nodePositions[1].join(",");
  const to = nodePositions[14].join(",");
  assert.ok(
    points.some((p, i) => p === from && points[i + 1] === to),
    "the leg runs straight across the gap",
  );
});

// A City Shortcut teleport leg is drawn as a single dashed segment between its
// two spots: even when a street path is stored for the crossing it is not
// walked, so no intermediate points appear on the jump.
test("shortcut legs get no street points", () => {
  const actions = [
    { type: "buy", item: "X", location: "Victor T Cyclops" },
    { type: "sell", item: "X", location: "Clock Stall" },
  ];
  // Milestone 5 unlocks the Cellar shortcut; this route crosses it 120 -> 137.
  const geometry = buildRouteGeometry(actions, 5, true, false, undefined, undefined, [], {
    "120-137": [[99, 99]],
  });
  const points = geometry.segments
    .flatMap((segment) => segment.points)
    .map(([x, y]) => `${x},${y}`);
  assert.ok(!points.includes("99,99"), "the crossing is not walked as a street");
  const shortcut = geometry.segments.find((segment) => segment.kind === "shortcut");
  assert.deepEqual(shortcut.points, [nodePositions[120], nodePositions[137]]);
});
