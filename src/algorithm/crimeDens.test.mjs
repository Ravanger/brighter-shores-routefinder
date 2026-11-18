import test from "node:test";
import assert from "node:assert/strict";
import GPS from "./gps.js";
import {
  crimeDens,
  edges,
  getEnabledCrimeDens,
  meetsCrimeDenRequirement,
  pruneCrimeDenToggles,
} from "./nodes.js";

// The Smugglers edge [32, 33] (weight 4.07) has a low enough weight that it
// is clearly the shortest path when it is enabled.
test("crime den edges are gated in GPS", () => {
  const without = new GPS(0, false).distance(32, 33);
  assert.ok(without.distance > 4.07);
  assert.notDeepEqual(without.path, [32, 33]);

  const withSmugglers = new GPS(0, false, ["SMUGGLERS"]).distance(32, 33);
  assert.deepEqual(withSmugglers, { distance: 4.07, path: [32, 33] });

  // A different den does not unlock the Smugglers edge.
  const withBurglars = new GPS(0, false, ["BURGLARS"]).distance(32, 33);
  assert.notDeepEqual(withBurglars.path, [32, 33]);
});

test("getEnabledCrimeDens returns ticked dens whose requirement is met", () => {
  // Nothing ticked.
  assert.deepEqual(getEnabledCrimeDens({}, 9, 99), []);
  // Level too low.
  assert.deepEqual(getEnabledCrimeDens({ SMUGGLERS: true }, 0, 27), []);
  // Boundary.
  assert.deepEqual(getEnabledCrimeDens({ SMUGGLERS: true }, 0, 28), [
    "SMUGGLERS",
  ]);
  assert.deepEqual(getEnabledCrimeDens({ COUNTERFEITERS: true }, 1, 32), []);
  assert.deepEqual(getEnabledCrimeDens({ COUNTERFEITERS: true }, 1, 33), [
    "COUNTERFEITERS",
  ]);
  // A higher milestone beats any level within it.
  assert.deepEqual(getEnabledCrimeDens({ COUNTERFEITERS: true }, 2, 0), [
    "COUNTERFEITERS",
  ]);
  // Empty inputs count as 0.
  assert.deepEqual(getEnabledCrimeDens({ SMUGGLERS: true }, "", ""), []);
  // Missing toggles are off.
  assert.deepEqual(getEnabledCrimeDens(undefined, 9, 99), []);
  assert.deepEqual(
    getEnabledCrimeDens({ SMUGGLERS: false, GANGSTERS: true }, 9, 99),
    ["GANGSTERS"],
  );
});

test("pruneCrimeDenToggles unticks dens below the requirement", () => {
  // Requirement met: kept as is.
  assert.deepEqual(pruneCrimeDenToggles({ SMUGGLERS: true }, 0, 28), {
    SMUGGLERS: true,
  });
  // Below the level cutoff: unticked.
  assert.deepEqual(pruneCrimeDenToggles({ SMUGGLERS: true }, 0, 27), {});
  // Below the milestone cutoff: unticked.
  assert.deepEqual(pruneCrimeDenToggles({ COUNTERFEITERS: true }, 0, 99), {});
  // Only the dens whose requirement is still met are kept.
  assert.deepEqual(
    pruneCrimeDenToggles({ COUNTERFEITERS: true, BURGLARS: true }, 1, 50),
    { COUNTERFEITERS: true },
  );
  // Empty inputs count as 0.
  assert.deepEqual(pruneCrimeDenToggles({ SMUGGLERS: true }, "", ""), {});
  // No toggles: nothing to keep.
  assert.deepEqual(pruneCrimeDenToggles(undefined, 9, 99), {});
});

test("meetsCrimeDenRequirement compares milestone then level", () => {
  const smugglers = crimeDens.find((den) => den.key === "SMUGGLERS");
  assert.equal(meetsCrimeDenRequirement(smugglers, 0, 27), false);
  // Boundary.
  assert.equal(meetsCrimeDenRequirement(smugglers, 0, 28), true);
  // A higher milestone beats any level within it.
  assert.equal(meetsCrimeDenRequirement(smugglers, 1, 0), true);
  // Empty, undefined and null inputs count as 0.
  assert.equal(meetsCrimeDenRequirement(smugglers, "", ""), false);
  assert.equal(meetsCrimeDenRequirement(smugglers, undefined, null), false);
});

test("crime den edges reference known dens, two per den", () => {
  const keys = new Set(crimeDens.map((den) => den.key));
  const denEdges = edges.filter((edge) => edge.crimeDen);
  assert.equal(denEdges.length, 10);
  for (const edge of denEdges) {
    assert.ok(keys.has(edge.crimeDen), `unknown den ${edge.crimeDen}`);
  }
  for (const den of crimeDens) {
    const count = denEdges.filter((edge) => edge.crimeDen === den.key).length;
    assert.equal(count, 2, `expected 2 edges for ${den.key}`);
  }
});
