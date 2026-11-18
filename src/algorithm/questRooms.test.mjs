import test from "node:test";
import assert from "node:assert/strict";
import GPS from "./gps.js";
import { edges, questRooms } from "./nodes.js";

// A quest room passage is two directed half-edge pairs around its room node
// (street → room → street). Pin the structure and the measured per-direction
// totals so an edit cannot silently change a passage's cost: the halves must
// sum to what was walked.
test("quest room passages are street → room → street half-edge pairs", () => {
  for (const { node, room, quest } of questRooms) {
    const halves = edges.filter(
      (edge) => edge.nodes[0] === node || edge.nodes[1] === node,
    );
    assert.equal(
      halves.length,
      4,
      `${room} needs two directed half-edge pairs`,
    );
    for (const half of halves) {
      assert.equal(
        half.quest,
        quest,
        `${room} half-edge carries the wrong quest`,
      );
      assert.equal(half.directed, true, `${room} half-edge must be directed`);
    }
  }

  const weight = (a, b) =>
    edges.find((edge) => edge.nodes[0] === a && edge.nodes[1] === b)?.weight;

  // Abandoned Alleyway: measured 6.34s from the Meggrit's Market side to the
  // Fortunehold Farm side, 9.6s back.
  assert.ok(Math.abs(weight(105, 136) + weight(136, 106) - 6.34) < 1e-9);
  assert.ok(Math.abs(weight(106, 136) + weight(136, 105) - 9.6) < 1e-9);
});

// The passage is only walkable once the quest is done: with it incomplete
// the route takes the long way around; with it complete the path goes
// through the room node.
test("quest room passages are gated in GPS", () => {
  const without = new GPS(0, false).distance(77, 13);
  assert.ok(!without.path.includes(136));

  const withQuest = new GPS(0, true).distance(77, 13);
  assert.deepEqual(withQuest.path, [77, 105, 136, 106, 13]);
  assert.ok(Math.abs(withQuest.distance - 17.12) < 1e-9);
});
