import GPS from "./gps.js";
import { edgePaths } from "./edgePaths.js";
import { bountyBoard, crimeDens, denRooms, edges, markets, portals } from "./nodes.js";
import { nodePositions } from "./nodePositions.js";
import { wikiToLatLng } from "./wikiMap.js";

const PADDING = 24;

// Adjacency between nodes, respecting edge direction: a step a -> b is a
// normal walk if an edge lists [a, b], or lists [b, a] and is undirected.
// Anything else on a GPS path — a portal stone jump or a City Shortcut
// teleport (edges carry `cityShortcut`) — is a jump drawn as its own dashed
// segment, tagged "teleport" or "shortcut" respectively.
const buildAdjacency = () => {
  const adjacency = new Set();
  for (const edge of edges) {
    if (edge.cityShortcut) {
      continue;
    }
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
 * positioned path nodes, in route order. Each point carries the `kind` of
 * the leg into it ("walk", "teleport" or "shortcut") and its `name` (the
 * shortcut or portal stone for jump legs, null for walks). Shared join
 * points appear once.
 * @param segments Segments from {@link buildRouteGeometry}
 * @returns {{x: number, y: number, kind: string, name: string | null}[]}
 */
export const flattenRoutePoints = (segments) => {
  const points = [];
  for (const segment of segments) {
    for (const [x, y] of segment.points) {
      const last = points[points.length - 1];
      if (last && last.x === x && last.y === y) {
        continue;
      }
      points.push({ x, y, kind: segment.kind, name: segment.name });
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
 *   routePoints: {x: number, y: number, kind: string, name: string | null,
 *     latLng: number[]}[],
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
    latLng: wikiToLatLng([point.x, point.y]),
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
        if (routePoints[i].kind !== "walk") {
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
      latLng: wikiToLatLng([stop.x, stop.y]),
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
    (hasReturn || (roundTrip && lastStep.node !== geometry.start.node))
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
      latLng: wikiToLatLng([geometry.start.x, geometry.start.y]),
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
 * Numbers the buy/sell actions 1..N in action order for the actions list,
 * matching the numbered markers on the map exactly. Teleport and Return
 * actions get null (no number). An action at an unknown market, or at a
 * market with no position (so the map cannot mark it either), gets null
 * and does not consume a number.
 * @param actions Actions from {@link pathfinder.findBestBounties}
 * @param positions Node number -> [x, y] (defaults to {@link nodePositions})
 * @returns {(number | null)[]} One entry per action, in action order
 */
export const assignStopNumbers = (actions, positions = nodePositions) => {
  const marketByName = new Map(
    Object.values(markets).map((market) => [market.name, market.node]),
  );
  let count = 0;
  return actions.map((action) => {
    if (action.type !== "buy" && action.type !== "sell") {
      return null;
    }
    const node = marketByName.get(action.location);
    if (node === undefined || !positions[node]) {
      return null;
    }
    count += 1;
    return count;
  });
};

/**
 * Turns a pathfinder actions list into the geometry for a schematic route map.
 * @param actions Actions from {@link pathfinder.findBestBounties} (buy/sell/
 *   teleport/Return, each with a `location` market name)
 * @param detectiveMilestone The player's Detective milestone (0-9)
 * @param battleOfFortuneholdCompleted Whether Battle of Fortunehold is done
 * @param roundTrip Whether the route returns to the bounty board
 * @param positions Node number -> [x, y] (defaults to {@link nodePositions})
 * @param board The bounty board the route starts at ({@link bountyBoard} or
 *   {@link expressBountyBoard})
 * @param enabledCrimeDens Keys from {@link crimeDens} the player has unlocked and can clear (see {@link getEnabledCrimeDens})
 * @param paths Walk edge "a-b" -> the street points between a and b
 *   (defaults to {@link edgePaths})
 * @returns {{
 *   segments: {points: number[][], kind: string, name: string | null}[],
 *   jumps: {kind: string, name: string, x: number, y: number}[],
 *   dens: {name: string, x: number, y: number}[],
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
  board = bountyBoard,
  enabledCrimeDens = [],
  paths = edgePaths,
) => {
  const marketByName = new Map(
    Object.values(markets).map((market) => [market.name, market.node]),
  );

  // Stops: the bounty board, then each buy/sell market in action order,
  // then the board again for the return trip. A market with no position
  // is skipped before numbering, so the map's numbers never have gaps —
  // the actions list numbers from the same ordering (see assignStopNumbers).
  const stops = [board.node];
  const numberedStops = [];
  for (const action of actions) {
    if (action.type !== "buy" && action.type !== "sell") {
      continue;
    }
    const node = marketByName.get(action.location);
    if (node === undefined || !positions[node]) {
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
  if (hasReturn || (roundTrip && stops[stops.length - 1] !== board.node)) {
    stops.push(board.node);
  }

  const milestone =
    detectiveMilestone === "" ||
    detectiveMilestone === undefined ||
    detectiveMilestone === null
      ? 0
      : detectiveMilestone;
  const gps = new GPS(
    milestone,
    battleOfFortuneholdCompleted,
    enabledCrimeDens,
  );
  const adjacency = buildAdjacency();
  // The shortcut crossings themselves (both directions), with their names:
  // a path step matching one of these is a shortcut, not a walk.
  const shortcutNames = new Map();
  for (const edge of edges) {
    if (!edge.cityShortcut) {
      continue;
    }
    const [a, b] = edge.nodes;
    shortcutNames.set(`${a}>${b}`, edge.cityShortcut);
    shortcutNames.set(`${b}>${a}`, edge.cityShortcut);
  }
  // Portal stones by node: a non-walk step that is not a shortcut crossing
  // is a portal jump, and the stone is one of its endpoints; the jump's
  // name is the stone's.
  const portalByNode = new Map(
    Object.values(portals).map((portal) => [portal.node, portal.name]),
  );
  // Den room nodes by number (see denRooms): a passage is two half-steps
  // around its room node, so when the path steps onto one the walk line
  // bends through the room's own position and the den dot is marked there.
  const denRoomByNode = new Map(denRooms.map((room) => [room.node, room]));
  const denNameByKey = new Map(crimeDens.map((den) => [den.key, den.name]));

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

  // Positioned nodes in path order. A step with no direct edge is a jump:
  // a City Shortcut crossing or a portal stone teleport; the kind carries
  // forward across unpositioned nodes so the drawn segment spanning them
  // takes it. Unpositioned nodes are skipped. Every shortcut endpoint node
  // sits at its actual teleport spot, so no special positioning is needed.
  const positioned = [];
  // The teleport/shortcut nodes the route actually uses, for map markers:
  // a portal jump marks the stone (one of the step's endpoints; the other
  // end is a normal room), a shortcut marks both teleport spots.
  const usedJumps = [];
  // Den rooms the route walks through, for map markers: each sits at its
  // own node position, so the walk line bends through the room.
  const usedDens = [];
  let pendingKind = null;
  let pendingName = null;
  for (let i = 0; i < fullPath.length; i++) {
    const node = fullPath[i];
    if (i > 0 && !adjacency.has(`${fullPath[i - 1]}>${node}`)) {
      const shortcutName = shortcutNames.get(`${fullPath[i - 1]}>${node}`);
      if (shortcutName) {
        pendingKind = "shortcut";
        pendingName = shortcutName;
        usedJumps.push({
          kind: "shortcut",
          name: shortcutName,
          nodes: [fullPath[i - 1], node],
        });
      } else {
        pendingKind = "teleport";
        pendingName =
          portalByNode.get(fullPath[i - 1]) ?? portalByNode.get(node);
        const stone = portalByNode.has(fullPath[i - 1])
          ? fullPath[i - 1]
          : node;
        usedJumps.push({ kind: "teleport", name: pendingName, nodes: [stone] });
      }
    }
    const position = positions[node];
    if (!position) {
      continue;
    }
    if (pendingKind === null && i > 0 && positions[fullPath[i - 1]]) {
      const from = fullPath[i - 1];
      // A directed edge stores its path in one direction only.
      const street =
        paths[`${from}-${node}`] ??
        [...(paths[`${node}-${from}`] ?? [])].reverse();
      for (const [x, y] of street) {
        positioned.push({ node: null, x, y, kind: "walk", name: null });
      }
    }
    const denRoom = denRoomByNode.get(node);
    if (denRoom) {
      usedDens.push({
        name: denNameByKey.get(denRoom.den),
        room: denRoom.room,
        x: position[0],
        y: position[1],
      });
    }
    positioned.push({
      node,
      x: position[0],
      y: position[1],
      kind: pendingKind ?? "walk",
      name: pendingName,
    });
    pendingKind = null;
    pendingName = null;
  }

  if (positioned.length === 0) {
    return null;
  }

  // Jump stops for map markers: each portal stone the route teleports
  // through, and both teleport spots of each City Shortcut crossing. Every
  // endpoint sits at its own position (the measured spot), so no special
  // resolution is needed. A jump crossed twice (round trip) is marked once.
  const jumps = [];
  const seenJumps = new Set();
  for (const jump of usedJumps) {
    for (const node of jump.nodes) {
      const position = positions[node];
      if (!position) {
        continue;
      }
      const key = `${jump.kind}:${position[0]},${position[1]}`;
      if (seenJumps.has(key)) {
        continue;
      }
      seenJumps.add(key);
      jumps.push({
        kind: jump.kind,
        name: jump.name,
        x: position[0],
        y: position[1],
      });
    }
  }

  // Den room markers, deduped: a round trip crossing the same passage both
  // ways lands on the same room.
  const dens = [];
  const seenDens = new Set();
  for (const den of usedDens) {
    const key = `${den.room}:${den.x},${den.y}`;
    if (seenDens.has(key)) {
      continue;
    }
    seenDens.add(key);
    dens.push(den);
  }

  // Split into walk runs; each jump is its own segment carrying the kind
  // ("teleport" or "shortcut") and name (the shortcut or portal stone) of
  // the leg into it. Walk segments carry a null name.
  const segments = [];
  let current = null;
  let previous = null;
  for (const point of positioned) {
    if (point.kind !== "walk") {
      if (current && current.points.length > 1) {
        segments.push(current);
      }
      if (previous) {
        segments.push({
          points: [
            [previous.x, previous.y],
            [point.x, point.y],
          ],
          kind: point.kind,
          name: point.name,
        });
      }
      current = { points: [[point.x, point.y]], kind: "walk", name: null };
    } else {
      if (!current) {
        current = { points: [], kind: "walk", name: null };
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

  const boardPosition = positions[board.node];
  return {
    segments,
    jumps,
    dens,
    stops: numberedStops.map((stop) => ({
      ...stop,
      x: positions[stop.node][0],
      y: positions[stop.node][1],
    })),
    start: boardPosition
      ? {
          node: board.node,
          label: board.name,
          x: boardPosition[0],
          y: boardPosition[1],
        }
      : null,
    viewBox,
  };
};
