import test from "node:test";
import assert from "node:assert/strict";
import { nodePositions } from "./nodePositions.js";
import {
  bountyBoard,
  crimeDens,
  denRooms,
  edges,
  expressBountyBoard,
  markets,
  portals,
  questRooms,
} from "./nodes.js";

test("every market, both bounty boards and both portals have a finite [x, y] position", () => {
  const expected = [
    ...Object.values(markets),
    bountyBoard,
    expressBountyBoard,
    ...Object.values(portals),
  ];

  assert.equal(expected.length, 31);

  for (const { name, node } of expected) {
    const position = nodePositions[node];
    assert.ok(
      Array.isArray(position),
      `${name} (node ${node}) has no position`,
    );
    assert.equal(position.length, 2, `${name} position is not [x, y]`);
    assert.ok(
      Number.isFinite(position[0]) && Number.isFinite(position[1]),
      `${name} position is not finite`,
    );
  }
});

// Sample positions pinned against the wiki GeoJSON (in-game [x, y]):
// the board markers and two shopkeepers are exact integer NPC positions,
// and Ignatius moved when the wiki put him on Twiddle Corner.
test("pins a sample of wiki positions", () => {
  assert.deepEqual(nodePositions[103], [436, 42]); // Guild Bounty Board
  assert.deepEqual(nodePositions[59], [429, 50]); // Express Bounty Board
  assert.deepEqual(nodePositions[84], [246, 49]); // Ralph Cyclops
  assert.deepEqual(nodePositions[36], [414, 93]); // Tonya the Tinkerer
  assert.deepEqual(nodePositions[53], [443, 61]); // Crenopolis Market Portal Stone
  assert.deepEqual(nodePositions[118], [327, 63]); // Ignatius, Twiddle Corner
});

// Measured in-game (2026-11-18), they override the wiki's map glyphs: pin
// a few so a regeneration cannot silently clobber the measurements.
test("pins the measured City Shortcut spots", () => {
  assert.deepEqual(nodePositions[120], [245, 37]); // Unicorn Farm (Cellar)
  assert.deepEqual(nodePositions[137], [365, 58]); // Snag Alley (Cellar)
  assert.deepEqual(nodePositions[123], [440, 23]); // Council Office (Trapdoor)
});

// Den room nodes: every room in denRooms has a finite position (its wiki
// polygon centre), used for routing through raided dens and the debug
// overlay.
test("every crime den room node has a finite position", () => {
  assert.equal(denRooms.length, crimeDens.reduce((sum, den) => sum + den.rooms.length, 0));
  for (const { den, room, node } of denRooms) {
    const position = nodePositions[node];
    assert.ok(Array.isArray(position), `${den} ${room} (node ${node}) has no position`);
    assert.equal(position.length, 2, `${den} ${room} position is not [x, y]`);
    assert.ok(
      Number.isFinite(position[0]) && Number.isFinite(position[1]),
      `${den} ${room} position is not finite`,
    );
  }
});

// Quest room nodes: every room in questRooms has a finite position (its wiki
// polygon centre), used for routing through opened passages.
test("every quest room node has a finite position", () => {
  for (const { room, node } of questRooms) {
    const position = nodePositions[node];
    assert.ok(Array.isArray(position), `${room} (node ${node}) has no position`);
    assert.equal(position.length, 2, `${room} position is not [x, y]`);
    assert.ok(
      Number.isFinite(position[0]) && Number.isFinite(position[1]),
      `${room} position is not finite`,
    );
  }
});

// An unpositioned node is skipped by the route map, so a walk through it is
// drawn as a straight line across buildings instead of along the street.
test("every graph node has a finite position", () => {
  for (const edge of edges) {
    for (const node of edge.nodes) {
      const position = nodePositions[node];
      assert.ok(
        Array.isArray(position) &&
          Number.isFinite(position[0]) &&
          Number.isFinite(position[1]),
        `node ${node} has no position`,
      );
    }
  }
});
