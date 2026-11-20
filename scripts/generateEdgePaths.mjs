// Fetches the Brighter Shores wiki's map data and writes
// src/algorithm/edgePaths.js: for every walk edge in nodes.js, the points of
// a walking path between its two nodes, so the route map draws walks along
// the streets instead of straight across buildings.
//
// A tile is walkable when inside a room or a one-tile doorway gap with a
// different room on each side (walls are the gaps between tile-aligned room
// outlines). Each edge's path is the shortest 8-way tile path (straight 240
// ticks, diagonal 339, no cutting wall corners), straightened where a direct
// line stays walkable. Other episodes' rooms are ignored (their coordinates
// overlap); den and quest rooms stay closed except on their own passage
// edges, which need a raid or a quest.
//
// Usage: node scripts/generateEdgePaths.mjs [saved gadget .js]
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PriorityQueue } from "@datastructures-js/priority-queue";
import { cityShortcuts, denRooms, edges, questRooms } from "../src/algorithm/nodes.js";
import { nodePositions } from "../src/algorithm/nodePositions.js";
import { GADGET_URL, extractGeojsonModules } from "./generateNodePositions.mjs";

const EPISODE = "Crenopolis";
const STRAIGHT_TICKS = 240;
const DIAGONAL_TICKS = 339;
const TICKS_PER_SECOND = 600;
// How far a node's position may sit off the walkable tiles (shop markers
// and spots can lie on a wall) and still be snapped onto them.
const SNAP_RADIUS = 3;
// The walk edges of the City Shortcut spots are timed on the tile grid, so
// their path time must match the weight; legacy edge weights predate the
// grid and drift from it, so only spot-attached edges are ratio-checked.
const SPOT_NODES = new Set(
  cityShortcuts.flatMap((shortcut) => shortcut.endpoints.map((e) => e.node)),
);

const key = (x, y) => `${x},${y}`;

const insideRings = (x, y, rings) => {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
};

/**
 * The walkable tiles of one episode's rooms: every tile whose centre is
 * inside a room polygon, plus every one-tile gap between two different rooms
 * (a doorway). Tile "x,y" covers [x, x+1] x [y, y+1].
 * @param rooms Room features from {@link extractGeojsonModules}
 * @param episode Only rooms of this episode are used
 * @param closed Names of rooms to leave out
 * @returns {Set<string>} Walkable tile keys
 */
export const buildWalkGrid = (rooms, episode = EPISODE, closed = new Set()) => {
  const walkable = new Set();
  // Unit wall segments ("v<x>,<y>" from (x,y) to (x,y+1), "h<x>,<y>" from
  // (x,y) to (x+1,y)) -> the room whose outline they belong to.
  const wallRoom = new Map();
  for (const room of rooms) {
    if (
      room.properties?.episode !== episode ||
      room.geometry?.type !== "Polygon" ||
      closed.has(room.properties.name)
    ) {
      continue;
    }
    const rings = room.geometry.coordinates;
    const xs = rings[0].map(([x]) => x);
    const ys = rings[0].map(([, y]) => y);
    for (let x = Math.floor(Math.min(...xs)); x < Math.max(...xs); ++x) {
      for (let y = Math.floor(Math.min(...ys)); y < Math.max(...ys); ++y) {
        if (insideRings(x + 0.5, y + 0.5, rings)) {
          walkable.add(key(x, y));
        }
      }
    }
    for (const ring of rings) {
      for (let i = 0; i + 1 < ring.length; ++i) {
        const [ax, ay] = ring[i].map(Math.round);
        const [bx, by] = ring[i + 1].map(Math.round);
        if (ax === bx) {
          for (let y = Math.min(ay, by); y < Math.max(ay, by); ++y) {
            wallRoom.set(`v${ax},${y}`, room);
          }
        } else if (ay === by) {
          for (let x = Math.min(ax, bx); x < Math.max(ax, bx); ++x) {
            wallRoom.set(`h${x},${ay}`, room);
          }
        }
      }
    }
  }
  for (const [wall, room] of [...wallRoom]) {
    const [x, y] = wall.slice(1).split(",").map(Number);
    // The tile just past this wall, and the wall on its far side.
    const tile = key(x, y);
    const far = wall[0] === "v" ? `v${x + 1},${y}` : `h${x},${y + 1}`;
    const other = wallRoom.get(far);
    if (other && other !== room) {
      walkable.add(tile);
    }
  }
  return walkable;
};

const snap = (walkable, [px, py]) => {
  let best = null;
  let bestDistance = Infinity;
  for (let dx = -SNAP_RADIUS; dx <= SNAP_RADIUS; ++dx) {
    for (let dy = -SNAP_RADIUS; dy <= SNAP_RADIUS; ++dy) {
      const x = Math.floor(px) + dx;
      const y = Math.floor(py) + dy;
      const distance = Math.hypot(x + 0.5 - px, y + 0.5 - py);
      if (walkable.has(key(x, y)) && distance < bestDistance) {
        best = [x, y];
        bestDistance = distance;
      }
    }
  }
  return best;
};

/**
 * Shortest 8-way tile path between two tiles. A diagonal step needs both
 * tiles it passes between to be walkable, so paths never cut a wall corner.
 * @param walkable Tile keys from {@link buildWalkGrid}
 * @param from Start tile [x, y]
 * @param to End tile [x, y]
 * @returns {{tiles: number[][], ticks: number} | null} Null when unreachable
 */
export const findTilePath = (walkable, from, to) => {
  const heuristic = ([x, y]) => {
    const dx = Math.abs(x - to[0]);
    const dy = Math.abs(y - to[1]);
    return (
      STRAIGHT_TICKS * Math.abs(dx - dy) + DIAGONAL_TICKS * Math.min(dx, dy)
    );
  };
  const queue = new PriorityQueue((a, b) => a.estimate - b.estimate);
  const cost = new Map([[key(...from), 0]]);
  const previous = new Map();
  queue.enqueue({ tile: from, estimate: heuristic(from) });
  while (queue.size() > 0) {
    const { tile } = queue.dequeue();
    const tileKey = key(...tile);
    if (tile[0] === to[0] && tile[1] === to[1]) {
      const tiles = [tile];
      for (let k = tileKey; previous.has(k); ) {
        const prior = previous.get(k);
        tiles.push(prior);
        k = key(...prior);
      }
      return { tiles: tiles.reverse(), ticks: cost.get(tileKey) };
    }
    for (let dx = -1; dx <= 1; ++dx) {
      for (let dy = -1; dy <= 1; ++dy) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const next = [tile[0] + dx, tile[1] + dy];
        if (!walkable.has(key(...next))) {
          continue;
        }
        if (
          dx !== 0 &&
          dy !== 0 &&
          (!walkable.has(key(tile[0] + dx, tile[1])) ||
            !walkable.has(key(tile[0], tile[1] + dy)))
        ) {
          continue;
        }
        const nextCost =
          cost.get(tileKey) +
          (dx !== 0 && dy !== 0 ? DIAGONAL_TICKS : STRAIGHT_TICKS);
        const nextKey = key(...next);
        if (nextCost < (cost.get(nextKey) ?? Infinity)) {
          cost.set(nextKey, nextCost);
          previous.set(nextKey, tile);
          queue.enqueue({ tile: next, estimate: nextCost + heuristic(next) });
        }
      }
    }
  }
  return null;
};

// Whether a straight line stays on walkable tiles. Each sample also checks
// a hair either side, so a line never grazes a wall corner.
const lineOfSight = (walkable, [ax, ay], [bx, by]) => {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.05);
  for (let i = 0; i <= steps; ++i) {
    const x = ax + ((bx - ax) * i) / steps;
    const y = ay + ((by - ay) * i) / steps;
    for (const [ox, oy] of [
      [-0.01, -0.01],
      [0.01, -0.01],
      [-0.01, 0.01],
      [0.01, 0.01],
    ]) {
      if (!walkable.has(key(Math.floor(x + ox), Math.floor(y + oy)))) {
        return false;
      }
    }
  }
  return true;
};

/**
 * The walking path between two positions: the tile path between their
 * snapped tiles, straightened wherever a direct line stays walkable.
 * @param walkable Tile keys from {@link buildWalkGrid}
 * @param from Start position [x, y]
 * @param to End position [x, y]
 * @returns {{points: number[][], seconds: number} | null} The points between
 *   the two positions (excluding both) and the tile path's walking time;
 *   null when either position is off the grid or there is no path
 */
export const findWalkPath = (walkable, from, to) => {
  const start = snap(walkable, from);
  const end = snap(walkable, to);
  if (!start || !end) {
    return null;
  }
  const path = findTilePath(walkable, start, end);
  if (!path) {
    return null;
  }
  const route = [
    from,
    ...path.tiles.map(([x, y]) => [x + 0.5, y + 0.5]),
    to,
  ];
  const points = [route[0]];
  for (let i = 0; i < route.length - 1; ) {
    let j = route.length - 1;
    while (j > i + 1 && !lineOfSight(walkable, route[i], route[j])) {
      --j;
    }
    points.push(route[j]);
    i = j;
  }
  return {
    points: points.slice(1, -1),
    seconds: path.ticks / TICKS_PER_SECOND,
  };
};

/**
 * Walking paths for every walk edge (City Shortcut teleports excluded).
 * @param rooms Room features from {@link extractGeojsonModules}
 * @param walkEdges Edges from src/algorithm/nodes.js
 * @param positions Node number -> [x, y]
 * @returns {{paths: Object<string, number[][]>, report: string[], unresolved: string[]}}
 *   `paths` is keyed "a-b" in each edge's node order; `report` lists
 *   spot-attached edges whose path time is far from the edge's weight
 */
export const buildEdgePaths = (rooms, walkEdges = edges, positions = nodePositions) => {
  const conditionalRooms = new Map(
    [...denRooms, ...questRooms].map((room) => [room.node, room.room]),
  );
  // One grid per opened room (null: all den and quest rooms closed).
  const grids = new Map();
  const gridFor = (open) => {
    if (!grids.has(open)) {
      const closed = new Set(conditionalRooms.values());
      closed.delete(open);
      grids.set(open, buildWalkGrid(rooms, EPISODE, closed));
    }
    return grids.get(open);
  };
  const paths = {};
  const report = [];
  const unresolved = [];
  for (const edge of walkEdges) {
    if (edge.cityShortcut) {
      continue;
    }
    const [a, b] = edge.nodes;
    if (!positions[a] || !positions[b]) {
      unresolved.push(`${a}-${b}: no position for one of the nodes`);
      continue;
    }
    const open = conditionalRooms.get(a) ?? conditionalRooms.get(b) ?? null;
    const path = findWalkPath(gridFor(open), positions[a], positions[b]);
    if (!path) {
      unresolved.push(`${a}-${b}: no walkable path`);
      continue;
    }
    paths[`${a}-${b}`] = path.points.map(([x, y]) => [
      Math.round(x * 100) / 100,
      Math.round(y * 100) / 100,
    ]);
    const ratio = path.seconds / edge.weight;
    if (
      (SPOT_NODES.has(a) || SPOT_NODES.has(b)) &&
      (ratio > 1.5 || ratio < 0.67)
    ) {
      report.push(
        `${a}-${b}: path ${path.seconds.toFixed(2)}s vs edge ${edge.weight}s`,
      );
    }
  }
  return { paths, report, unresolved };
};

const main = async (gadgetPath) => {
  let source = GADGET_URL;
  // Stamp the header with the source's date: the saved copy's mtime when run
  // offline, so re-running against the same file does not churn the diff.
  let fetchedAt = new Date().toISOString();
  let text;
  if (gadgetPath) {
    source = gadgetPath;
    fetchedAt = statSync(gadgetPath).mtime.toISOString();
    text = readFileSync(gadgetPath, "utf8");
  } else {
    const response = await fetch(GADGET_URL);
    if (!response.ok) {
      throw new Error(`Fetching ${GADGET_URL} failed: ${response.status}`);
    }
    text = await response.text();
  }
  const { rooms } = extractGeojsonModules(text);
  const { paths, report, unresolved } = buildEdgePaths(rooms);

  if (unresolved.length > 0) {
    console.error("Could not build paths for:");
    for (const line of unresolved) {
      console.error(`  - ${line}`);
    }
    process.exit(1);
  }
  if (report.length > 0) {
    console.warn("Path time far from the edge weight (check the node positions):");
    for (const line of report) {
      console.warn(`  - ${line}`);
    }
  }

  const formatPath = ([edge, points]) =>
    `  "${edge}": [${points.map(([x, y]) => `[${x}, ${y}]`).join(", ")}],`;
  const body = `// Generated by \`node scripts/generateEdgePaths.mjs\` — do not edit by hand.
// Source: ${source === GADGET_URL ? GADGET_URL : `saved copy of ${GADGET_URL}`}
// Fetched: ${fetchedAt}
// Walk edge "a-b" (node order as in nodes.js) -> the points between node a
// and node b, wiki in-game [x, y]: a tile path over the wiki room outlines
// and doorways. Empty when the two nodes are in line of sight.
export const edgePaths = {
${Object.entries(paths).map(formatPath).join("\n")}
};
`;
  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "algorithm",
    "edgePaths.js",
  );
  writeFileSync(outPath, body);
  console.log(`Wrote ${outPath} (${Object.keys(paths).length} paths)`);
};

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv[2]);
}
