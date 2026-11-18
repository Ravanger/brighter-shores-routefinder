import test from "node:test";
import assert from "node:assert/strict";
import pathfinder from "./pathfinder.js";
import GPS from "./gps.js";
import { bounties } from "./bounties.js";

// CARROTS: buy at the Greengrocers (node 21), sell at the Toy Stall (36).
// The first buy's distance is the walk from the starting board plus the
// 3s it takes to buy the first item, so it pins the start node exactly.
test("starts at the Guild Bounty Board and returns there by default", () => {
  const result = pathfinder.findBestBounties(["CARROTS"], [], 0, false, true);
  const gps = new GPS(0, false);

  const buy = result.actions.find((action) => action.type === "buy");
  assert.equal(buy.location, "Greengrocers");
  assert.equal(buy.distance, gps.distance(103, 21).distance + 3);

  const ret = result.actions.find((action) => action.type === "Return");
  assert.equal(ret.location, "Guild Bounty Board");
});

test("starts at the Express Bounty Board and returns there when enabled", () => {
  const result = pathfinder.findBestBounties(
    ["CARROTS"],
    [],
    0,
    false,
    true,
    true,
  );
  const gps = new GPS(0, false);

  const buy = result.actions.find((action) => action.type === "buy");
  assert.equal(buy.location, "Greengrocers");
  assert.equal(buy.distance, gps.distance(59, 21).distance + 3);

  const ret = result.actions.find((action) => action.type === "Return");
  assert.equal(ret.location, "Express Bounty Board");
});

// HOMESPUN_CLOTH: buy at the Textiles Stall (104), sell at the Clock Stall
// (26). The walk between them crosses the Smugglers den edge [32, 33], so
// enabling the den shortens the route.
test("routes through enabled crime dens", () => {
  const without = pathfinder.findBestBounties(
    ["HOMESPUN_CLOTH"],
    [],
    0,
    false,
    true,
  );
  const withSmugglers = pathfinder.findBestBounties(
    ["HOMESPUN_CLOTH"],
    [],
    0,
    false,
    true,
    false,
    ["SMUGGLERS"],
  );

  assert.ok(withSmugglers.distance < without.distance);

  // Tolerance: the leg is a difference of two accumulated floating-point
  // sums, which does not always round identically to the direct sum.
  const gps = new GPS(0, false, ["SMUGGLERS"]);
  const buy = withSmugglers.actions.find((action) => action.type === "buy");
  const sell = withSmugglers.actions.find((action) => action.type === "sell");
  const leg = gps.distance(104, 26).distance + 4;
  assert.ok(Math.abs(sell.distance - buy.distance - leg) < 1e-9);
});

