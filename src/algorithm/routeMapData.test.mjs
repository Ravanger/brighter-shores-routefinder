import test from "node:test";
import assert from "node:assert/strict";
import { buildRouteGeometry } from "./routeMapData.js";

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
