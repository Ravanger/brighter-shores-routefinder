import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRouteGeometry,
  buildRouteSteps,
  flattenRoutePoints,
  formatStopNumbers,
} from "./routeMapData.js";

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
    x: 513,
    y: 114,
  });
  assert.deepEqual(geometry.stops, [
    { node: 36, label: "Toy Stall", number: 1, x: 491, y: 165 },
    { node: 84, label: "Cheese Shop", number: 2, x: 323, y: 121 },
  ]);

  // Legs: board -> Toy Stall (walk), Toy Stall -> Cheese Shop (teleport via
  // the Outskirts portal stone), Cheese Shop -> board (teleport via the
  // Market portal stone).
  assert.deepEqual(geometry.segments, [
    { points: [[513, 114], [491, 165]], dashed: false },
    { points: [[491, 165], [369.56, 133.22]], dashed: true },
    { points: [[369.56, 133.22], [323, 121]], dashed: false },
    { points: [[323, 121], [520.5, 133.5]], dashed: true },
    { points: [[520.5, 133.5], [513, 114]], dashed: false },
  ]);

  // Bounding box of the positioned nodes plus 24 units of padding.
  assert.deepEqual(geometry.viewBox, [299, 90, 245.5, 99]);
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
    { x: 513, y: 114, dashed: false },
    { x: 491, y: 165, dashed: false },
    { x: 369.56, y: 133.22, dashed: true },
    { x: 323, y: 121, dashed: false },
    { x: 520.5, y: 133.5, dashed: true },
    { x: 513, y: 114, dashed: false },
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
      x: 491,
      y: 165,
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
      x: 323,
      y: 121,
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
      x: 513,
      y: 114,
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
    { x: 513, y: 114, dashed: false, latLng: [42, 436] },
    { x: 491, y: 165, dashed: false, latLng: [93, 414] },
    { x: 369.56, y: 133.22, dashed: true, latLng: [61.22, 292.56] },
    { x: 323, y: 121, dashed: false, latLng: [49, 246] },
    { x: 520.5, y: 133.5, dashed: true, latLng: [61.5, 443.5] },
    { x: 513, y: 114, dashed: false, latLng: [42, 436] },
  ]);
  assert.deepEqual(route.bounds, [
    [42, 246],
    [93, 443.5],
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
