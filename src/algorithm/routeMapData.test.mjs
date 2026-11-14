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

// Buy at the Toy Stall, sell at the Cheese Shop, then return to the board.
// The teleport action in the middle is an intermediate step, not a stop.
const sampleActions = [
  { type: "buy", item: "CARROTS", location: "Toy Stall", distance: 10 },
  { type: "teleport", location: "Crenopolis Market", distance: 18 },
  { type: "sell", item: "CARROTS", location: "Cheese Shop", distance: 30 },
  { type: "Return", location: "Guild Bounty Board", distance: 60 },
];

test("builds numbered stops, the start marker and solid/dashed segments", () => {
  const geometry = buildRouteGeometry(sampleActions, 0, false, true);

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
  // Market portal stone).
  assert.deepEqual(geometry.segments, [
    { points: [[436, 42], [414, 93]], dashed: false },
    { points: [[414, 93], [293, 61]], dashed: true },
    { points: [[293, 61], [246, 49]], dashed: false },
    { points: [[246, 49], [443, 61]], dashed: true },
    { points: [[443, 61], [436, 42]], dashed: false },
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
    undefined,
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
    { points: [[429, 50], [414, 93]], dashed: false },
    { points: [[414, 93], [293, 61]], dashed: true },
    { points: [[293, 61], [246, 49]], dashed: false },
    { points: [[246, 49], [443, 61]], dashed: true },
    { points: [[443, 61], [429, 50]], dashed: false },
  ]);

  const route = buildRouteSteps(geometry, sampleActions, true);
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

test("flattens segments to ordered points, flagging teleport legs", () => {
  const geometry = buildRouteGeometry(sampleActions, 0, false, true);

  assert.deepEqual(flattenRoutePoints(geometry.segments), [
    { x: 436, y: 42, dashed: false },
    { x: 414, y: 93, dashed: false },
    { x: 293, y: 61, dashed: true },
    { x: 246, y: 49, dashed: false },
    { x: 443, y: 61, dashed: true },
    { x: 436, y: 42, dashed: false },
  ]);
});

test("flattenRoutePoints skips duplicate join points and empty segments", () => {
  assert.deepEqual(
    flattenRoutePoints([
      { points: [[1, 2]], dashed: false },
      { points: [], dashed: true },
      {
        points: [
          [1, 2],
          [3, 4],
        ],
        dashed: false,
      },
    ]),
    [
      { x: 1, y: 2, dashed: false },
      { x: 3, y: 4, dashed: false },
    ],
  );
  assert.deepEqual(flattenRoutePoints([]), []);
});

test("builds steps, places, route points and bounds for the map", () => {
  const geometry = buildRouteGeometry(sampleActions, 0, false, true);
  const route = buildRouteSteps(geometry, sampleActions, true);

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
    { x: 436, y: 42, dashed: false, latLng: [42, 436] },
    { x: 414, y: 93, dashed: false, latLng: [93, 414] },
    { x: 293, y: 61, dashed: true, latLng: [61, 293] },
    { x: 246, y: 49, dashed: false, latLng: [49, 246] },
    { x: 443, y: 61, dashed: true, latLng: [61, 443] },
    { x: 436, y: 42, dashed: false, latLng: [42, 436] },
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

test("list numbering matches the map steps for the same actions", () => {
  const geometry = buildRouteGeometry(sampleActions, 0, false, true);
  const route = buildRouteSteps(geometry, sampleActions, true);
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
