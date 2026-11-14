import GPS from "./gps.js";
import { bountyBoard, edges, markets } from "./nodes.js";
import { nodePositions } from "./nodePositions.js";

const PADDING = 24;

// Adjacency between nodes, respecting edge direction: a step a -> b is a
// normal walk if an edge lists [a, b], or lists [b, a] and is undirected.
// Anything else on a GPS path is a teleport jump to a portal stone.
const buildAdjacency = () => {
  const adjacency = new Set();
  for (const edge of edges) {
    const [a, b] = edge.nodes;
    adjacency.add(`${a}>${b}`);
    if (!edge.directed) {
      adjacency.add(`${b}>${a}`);
    }
  }
  return adjacency;
};

/**
 * Turns a pathfinder actions list into the geometry for a schematic route map.
 * @param actions Actions from {@link pathfinder.findBestBounties} (buy/sell/
 *   teleport/Return, each with a `location` market name)
 * @param detectiveMilestone The player's Detective milestone (0-9)
 * @param battleOfFortuneholdCompleted Whether Battle of Fortunehold is done
 * @param roundTrip Whether the route returns to the bounty board
 * @param positions Node number -> [x, y] (defaults to {@link nodePositions})
 * @returns {{
 *   segments: {points: number[][], dashed: boolean}[],
 *   stops: {node: number, label: string, number: number, x: number, y: number}[],
 *   start: {node: number, label: string, x: number, y: number} | null,
 *   viewBox: number[]
 * } | null} Null when there is nothing to draw (no buy/sell stops, or no stop
 * has a position).
 */
export const buildRouteGeometry = (
  actions,
  detectiveMilestone,
  battleOfFortuneholdCompleted,
  roundTrip,
  positions = nodePositions,
) => {
  const marketByName = new Map(
    Object.values(markets).map((market) => [market.name, market.node]),
  );

  // Stops: the bounty board, then each buy/sell market in action order,
  // then the board again for the return trip.
  const stops = [bountyBoard.node];
  const numberedStops = [];
  for (const action of actions) {
    if (action.type !== "buy" && action.type !== "sell") {
      continue;
    }
    const node = marketByName.get(action.location);
    if (node === undefined) {
      continue;
    }
    stops.push(node);
    numberedStops.push({
      node,
      label: action.location,
      number: numberedStops.length + 1,
    });
  }

  if (numberedStops.length === 0) {
    return null;
  }

  const hasReturn = actions.some((action) => action.type === "Return");
  if (
    hasReturn ||
    (roundTrip && stops[stops.length - 1] !== bountyBoard.node)
  ) {
    stops.push(bountyBoard.node);
  }

  const milestone =
    detectiveMilestone === "" ||
    detectiveMilestone === undefined ||
    detectiveMilestone === null
      ? 0
      : detectiveMilestone;
  const gps = new GPS(milestone, battleOfFortuneholdCompleted);
  const adjacency = buildAdjacency();

  // The true node-by-node path, legs concatenated (shared join node deduped).
  // A leg that cannot be routed is skipped rather than breaking the map.
  const fullPath = [];
  for (let i = 0; i < stops.length - 1; i++) {
    let path;
    try {
      path = gps.distance(stops[i], stops[i + 1]).path;
    } catch {
      continue;
    }
    if (fullPath.length === 0) {
      fullPath.push(...path);
    } else {
      fullPath.push(...path.slice(1));
    }
  }

  // Positioned nodes in path order. A step with no direct edge is a teleport
  // jump; the flag carries forward across unpositioned nodes so the drawn
  // segment spanning them is dashed. Unpositioned nodes are skipped.
  const positioned = [];
  let pendingTeleport = false;
  for (let i = 0; i < fullPath.length; i++) {
    const node = fullPath[i];
    if (i > 0 && !adjacency.has(`${fullPath[i - 1]}>${node}`)) {
      pendingTeleport = true;
    }
    const position = positions[node];
    if (!position) {
      continue;
    }
    positioned.push({
      node,
      x: position[0],
      y: position[1],
      teleport: pendingTeleport,
    });
    pendingTeleport = false;
  }

  if (positioned.length === 0) {
    return null;
  }

  // Split into solid runs; each teleport jump is its own dashed segment.
  const segments = [];
  let current = null;
  let previous = null;
  for (const point of positioned) {
    if (point.teleport) {
      if (current && current.points.length > 1) {
        segments.push(current);
      }
      if (previous) {
        segments.push({
          points: [
            [previous.x, previous.y],
            [point.x, point.y],
          ],
          dashed: true,
        });
      }
      current = { points: [[point.x, point.y]], dashed: false };
    } else {
      if (!current) {
        current = { points: [], dashed: false };
      }
      current.points.push([point.x, point.y]);
    }
    previous = point;
  }
  if (current && current.points.length > 1) {
    segments.push(current);
  }

  const xs = positioned.map((point) => point.x);
  const ys = positioned.map((point) => point.y);
  const viewBox = [
    Math.min(...xs) - PADDING,
    Math.min(...ys) - PADDING,
    Math.max(...xs) - Math.min(...xs) + PADDING * 2,
    Math.max(...ys) - Math.min(...ys) + PADDING * 2,
  ];

  const boardPosition = positions[bountyBoard.node];
  return {
    segments,
    stops: numberedStops
      .filter((stop) => positions[stop.node])
      .map((stop) => ({
        ...stop,
        x: positions[stop.node][0],
        y: positions[stop.node][1],
      })),
    start: boardPosition
      ? {
          node: bountyBoard.node,
          label: bountyBoard.name,
          x: boardPosition[0],
          y: boardPosition[1],
        }
      : null,
    viewBox,
  };
};
