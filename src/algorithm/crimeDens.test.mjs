import test from "node:test";
import assert from "node:assert/strict";
import GPS from "./gps.js";
import {
  crimeDens,
  denRooms,
  edges,
  getEnabledCrimeDens,
  meetsCrimeDenRequirement,
  pruneCrimeDenToggles,
} from "./nodes.js";

// The Smugglers passage via the Geld Family Logistics (node 127, measured
// 4.07s total) has a low enough weight that it is clearly the shortest
// path when the den is enabled.
test("crime den edges are gated in GPS", () => {
  const without = new GPS(0, false).distance(32, 33);
  assert.ok(without.distance > 4.07);
  assert.notDeepEqual(without.path, [32, 127, 33]);

  const withSmugglers = new GPS(0, false, ["SMUGGLERS"]).distance(32, 33);
  assert.deepEqual(withSmugglers.path, [32, 127, 33]);
  assert.ok(Math.abs(withSmugglers.distance - 4.07) < 1e-9);

  // A different den does not unlock the Smugglers passage.
  const withBurglars = new GPS(0, false, ["BURGLARS"]).distance(32, 33);
  assert.notDeepEqual(withBurglars.path, [32, 127, 33]);
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

test("crime den half-edges reference known dens, four per den", () => {
  const keys = new Set(crimeDens.map((den) => den.key));
  const denEdges = edges.filter((edge) => edge.crimeDen);
  assert.equal(denEdges.length, 20);
  for (const edge of denEdges) {
    assert.ok(keys.has(edge.crimeDen), `unknown den ${edge.crimeDen}`);
  }
  for (const den of crimeDens) {
    const count = denEdges.filter((edge) => edge.crimeDen === den.key).length;
    assert.equal(count, 4, `expected 4 half-edges for ${den.key}`);
  }
});

// Each passage is two half-edges around its room node (street → room →
// street). Pin the measured in-game totals so an edit cannot silently
// change a passage's cost: the halves must sum to what was walked.
test("each den room's half-edges sum to the measured passage time", () => {
  const measured = new Map([
    [126, 5], // Geld Family Residence
    [127, 4.07], // Geld Family Logistics
    [128, 6.62], // Dilapidated Warehouse
    [129, 7], // Slant Street Cart House
    [130, 5], // Market Chambers
    [131, 4.43], // Oscen's Warehouse
    [132, 3.19], // Four Winds Backroom
    [133, 2.57], // Four Winds Side Room
    [134, 2.97], // Gillad's House
    [135, 6.1], // The Quill Club
  ]);

  for (const { node, den, room } of denRooms) {
    const halves = edges.filter(
      (edge) => edge.crimeDen && edge.nodes.includes(node),
    );
    assert.equal(halves.length, 2, `${den} ${room} needs two half-edges`);
    for (const half of halves) {
      assert.equal(
        half.crimeDen,
        den,
        `${den} ${room} half-edge carries the wrong den`,
      );
    }
    const streets = halves.flatMap((half) =>
      half.nodes.filter((n) => n !== node),
    );
    assert.notDeepEqual(
      streets,
      [streets[0], streets[0]],
      `${den} ${room} passage must join two different streets`,
    );
    const total = halves.reduce((sum, half) => sum + half.weight, 0);
    assert.ok(
      Math.abs(total - measured.get(node)) < 1e-9,
      `${den} ${room} halves sum to ${total}, expected ${measured.get(node)}`,
    );
  }
});
