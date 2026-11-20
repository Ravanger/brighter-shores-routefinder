import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWalkGrid,
  findTilePath,
  findWalkPath,
} from "./generateEdgePaths.mjs";

const room = (name, [x0, y0, x1, y1], episode = "Crenopolis") => ({
  properties: { name, category: "Room", episode },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
        [x0, y0],
      ],
    ],
  },
});

// Two rooms one tile apart along x = 4..5 for y = 2..3 only: that gap tile
// is the doorway. Elsewhere the rooms are two tiles apart (a wall).
const west = room("West", [0, 0, 4, 5]);
const east = room("East", [6, 0, 10, 5]);
const nub = room("East", [5, 2, 6, 3]);

test("a one-tile gap between two rooms is a walkable doorway", () => {
  const walkable = buildWalkGrid([west, east, nub]);
  assert.ok(walkable.has("0,0"));
  assert.ok(walkable.has("9,4"));
  assert.ok(walkable.has("5,2"));
  assert.ok(!walkable.has("4,0"));
  assert.ok(!walkable.has("5,0"));
  // The gap tile next to the nub: West's wall at x = 4, the nub's at x = 5.
  assert.ok(walkable.has("4,2"));
  assert.ok(!walkable.has("4,1"));
});

test("paths go through the doorway, and there is none without one", () => {
  const walkable = buildWalkGrid([west, east, nub]);
  const path = findWalkPath(walkable, [1.5, 0.5], [8.5, 4.5]);
  assert.ok(path);
  assert.ok(
    path.points.some(([x, y]) => x >= 4 && x <= 5 && y >= 2 && y <= 3),
    "the path passes the doorway tile",
  );

  assert.equal(
    findWalkPath(buildWalkGrid([west, east]), [1.5, 0.5], [8.5, 4.5]),
    null,
  );
});

test("closed rooms and other episodes are not walkable", () => {
  assert.equal(buildWalkGrid([west], "Crenopolis", new Set(["West"])).size, 0);
  assert.equal(buildWalkGrid([room("Elsewhere", [0, 0, 2, 2], "Hopeport")]).size, 0);
});

// An L of tiles: the diagonal step from (0,0) to (1,1) would cut the wall
// corner at (1,0), so the path takes two straight steps (480 ticks).
test("diagonal steps never cut a wall corner", () => {
  const walkable = new Set(["0,0", "0,1", "1,1"]);
  const path = findTilePath(walkable, [0, 0], [1, 1]);
  assert.deepEqual(path.tiles, [
    [0, 0],
    [0, 1],
    [1, 1],
  ]);
  assert.equal(path.ticks, 480);
});
