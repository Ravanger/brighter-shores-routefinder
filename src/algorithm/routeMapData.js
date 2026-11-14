import GPS from "./gps.js";
import { bounties as bountyData } from "./bounties.js";
import { bountyBoard, edges, markets, portals } from "./nodes.js";
import { nodePositions } from "./nodePositions.js";
import { bfTileToLatLng } from "./wikiMap.js";

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
 * Flattens the segments from {@link buildRouteGeometry} into the ordered
 * positioned path nodes, in route order. Each point carries `dashed` when
 * the leg into it is a teleport jump. Shared join points appear once.
 * @param segments Segments from {@link buildRouteGeometry}
 * @returns {{x: number, y: number, dashed: boolean}[]}
 */
export const flattenRoutePoints = (segments) => {
  const points = [];
  for (const segment of segments) {
    for (const [x, y] of segment.points) {
      const last = points[points.length - 1];
      if (last && last.x === x && last.y === y) {
        continue;
      }
      points.push({ x, y, dashed: segment.dashed });
    }
  }
  return points;
};

/**
 * Groups consecutive stop numbers into ranges: [9, 10, 11] -> "9–11",
 * [4, 7] -> "4, 7", [4, 5, 7] -> "4–5, 7".
 * @param numbers Stop numbers in route order
 * @returns {string}
 */
export const formatStopNumbers = (numbers) => {
  const runs = [];
  let start = numbers[0];
  let prev = numbers[0];
  for (const n of numbers.slice(1)) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    runs.push([start, prev]);
    start = n;
    prev = n;
  }
  runs.push([start, prev]);
  return runs
    .map(([a, b]) => (a === b ? String(a) : `${a}–${b}`))
    .join(", ");
};

/**
 * Turns route geometry + actions into the step list for the map: one step
 * per buy/sell action (plus a Return step), each with its position, whether
 * the leg into it teleports (and to which portal stone), plus the distinct
 * places (one marker per location) and the ordered route points as latLngs.
 * @param geometry Geometry from {@link buildRouteGeometry}
 * @param actions Actions from {@link pathfinder.findBestBounties}
 * @param roundTrip Whether the route returns to the bounty board
 * @param positions Node number -> [x, y] (defaults to {@link nodePositions})
 * @returns {{
 *   steps: {number: number | null, type: string, item: string | null,
 *     location: string, node: number, x: number, y: number,
 *     latLng: number[], teleport: boolean, portal: string | null,
 *     pointIndex: number}[],
 *   places: {node: number, label: string, latLng: number[], numbers: number[]}[],
 *   routePoints: {x: number, y: number, dashed: boolean, latLng: number[]}[],
 *   bounds: number[][]
 * } | null}
 */
export const buildRouteSteps = (
  geometry,
  actions,
  roundTrip,
  positions = nodePositions,
) => {
  if (!geometry) {
    return null;
  }

  const buySell = actions.filter(
    (action) => action.type === "buy" || action.type === "sell",
  );
  const routePoints = flattenRoutePoints(geometry.segments).map((point) => ({
    ...point,
    latLng: bfTileToLatLng([point.x, point.y]),
  }));
  const indexOfPoint = (x, y, after = -1) =>
    routePoints.findIndex(
      (point, i) => i > after && point.x === x && point.y === y,
    );
  const portalByPosition = new Map();
  for (const portal of Object.values(portals)) {
    const position = positions[portal.node];
    if (position) {
      portalByPosition.set(`${position[0]},${position[1]}`, portal.name);
    }
  }
  // The leg into a stop runs from the previous point in route order to the
  // stop's point. The board appears twice (start and return), so the search
  // always continues after the previous point, never back to the start.
  const legInto = (fromIdx, toX, toY) => {
    const toIdx = indexOfPoint(toX, toY, fromIdx);
    let teleport = false;
    let portal = null;
    if (toIdx !== -1) {
      for (let i = fromIdx + 1; i <= toIdx; i++) {
        if (routePoints[i].dashed) {
          teleport = true;
          if (portal === null) {
            portal =
              portalByPosition.get(
                `${routePoints[i].x},${routePoints[i].y}`,
              ) ?? null;
          }
        }
      }
    }
    return { teleport, portal, toIdx };
  };

  const steps = [];
  let cursor = geometry.start
    ? indexOfPoint(geometry.start.x, geometry.start.y)
    : -1;
  for (const stop of geometry.stops) {
    const action = buySell[stop.number - 1];
    const leg =
      cursor === -1
        ? { teleport: false, portal: null, toIdx: -1 }
        : legInto(cursor, stop.x, stop.y);
    steps.push({
      number: stop.number,
      type: action?.type ?? "buy",
      item: action?.item ?? null,
      location: stop.label,
      node: stop.node,
      x: stop.x,
      y: stop.y,
      latLng: bfTileToLatLng([stop.x, stop.y]),
      teleport: leg.teleport,
      portal: leg.portal,
      // Index into routePoints of this stop's position (the previous point
      // when the leg into it could not be traced, e.g. a repeated stop).
      pointIndex: leg.toIdx !== -1 ? leg.toIdx : Math.max(cursor, 0),
    });
    if (leg.toIdx !== -1) {
      cursor = leg.toIdx;
    }
  }

  const hasReturn = actions.some((action) => action.type === "Return");
  const lastStep = steps[steps.length - 1];
  if (
    geometry.start &&
    lastStep &&
    (hasReturn || (roundTrip && lastStep.node !== bountyBoard.node))
  ) {
    const leg =
      cursor === -1
        ? { teleport: false, portal: null, toIdx: -1 }
        : legInto(cursor, geometry.start.x, geometry.start.y);
    steps.push({
      number: null,
      type: "Return",
      item: null,
      location: geometry.start.label,
      node: geometry.start.node,
      x: geometry.start.x,
      y: geometry.start.y,
      latLng: bfTileToLatLng([geometry.start.x, geometry.start.y]),
      teleport: leg.teleport,
      portal: leg.portal,
      pointIndex: leg.toIdx !== -1 ? leg.toIdx : Math.max(cursor, 0),
    });
  }

  const places = [];
  const byNode = new Map();
  for (const step of steps) {
    if (step.number === null) {
      continue;
    }
    if (!byNode.has(step.node)) {
      const place = {
        node: step.node,
        label: step.location,
        latLng: step.latLng,
        numbers: [],
      };
      byNode.set(step.node, place);
      places.push(place);
    }
    byNode.get(step.node).numbers.push(step.number);
  }

  const lats = routePoints.map((point) => point.latLng[0]);
  const lngs = routePoints.map((point) => point.latLng[1]);
  const bounds = [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
  return { steps, places, routePoints, bounds };
};

/**
 * Caption for the step-through view. `index` is the 0-based step state
 * (0 = at the start); `total` is the number of buy/sell stops.
 * @param steps Steps from {@link buildRouteSteps}
 * @param index Current step state
 * @param total Number of buy/sell stops
 * @returns {string}
 */
export const formatStepCaption = (steps, index, total) => {
  if (index === 0) {
    return `Start at ${bountyBoard.name}`;
  }
  const step = steps[index - 1];
  if (!step) {
    return "";
  }
  if (step.type === "Return") {
    return step.teleport && step.portal
      ? `Teleport to ${step.portal}, then return to ${step.location}`
      : `Return to ${step.location}`;
  }
  const item =
    step.item && bountyData[step.item]
      ? bountyData[step.item].name
      : step.item;
  const action =
    step.type === "buy"
      ? `Buy ${item} at ${step.location}`
      : `Sell ${item} at ${step.location}`;
  const teleport =
    step.teleport && step.portal
      ? `Teleport to ${step.portal}, then `
      : step.teleport
        ? "Teleport, then "
        : "";
  return `Step ${step.number} of ${total}: ${teleport}${action}`;
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
