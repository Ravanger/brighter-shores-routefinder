// Fetches the Brighter Shores wiki's map data and writes
// src/algorithm/nodePositions.js: a node number -> [x, y] map in wiki
// in-game coords for every market, both bounty boards, the two portal
// stones and the City Shortcut endpoint nodes without a marker of their
// own (their position is the shortcut's map glyph in its room).
//
// Usage: node scripts/generateNodePositions.mjs
//
// The wiki has no standalone GeoJSON endpoint: the map data (rooms as
// polygons, entities as points) is embedded in the map gadget's JavaScript
// (MediaWiki:Gadget-leaflet-wiki.js) as JSON.parse data modules. The
// generator extracts those modules by shape — a FeatureCollection of
// Polygons is the rooms, FeatureCollections of Points are the entities —
// so it keeps working if the gadget's module numbering changes.
//
// The positions come from an explicit name mapping below, resolved against
// the wiki data. A shop resolves to its shopkeeper NPC's marker (more
// precise than the room centre); a room resolves to its polygon centroid.
// Nothing is guessed: if a name, room or marker cannot be resolved the
// script prints what is missing and exits non-zero.
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bountyBoard, expressBountyBoard, markets, portals } from "../src/algorithm/nodes.js";

const GADGET_URL =
  "https://brightershoreswiki.org/w/MediaWiki:Gadget-leaflet-wiki.js?action=raw";

// Market name (as in src/algorithm/nodes.js) -> where it lives in the
// wiki GeoJSON. { room } uses the room's polygon centroid; { room, marker }
// uses that marker's position inside the room (the shopkeeper NPC for a
// shop). The room is the human-readable location; marker lookup is by
// entity name across the whole GeoJSON.
const MAPPING = {
  // Markets
  "Victor T Cyclops": {
    room: "Cyclops Store Cave",
    marker: "Victor T Cyclops",
  },
  "Fortunehold Farm": { room: "Fortunehold Farm" },
  "Butcher's Stall": { room: "Lord's Road West", marker: "Bill the Butcher" },
  "Hermar's Homeware": { room: "Cobble Corner", marker: "Hermar" },
  Greengrocers: { room: "Greengrocers" },
  "Clock Stall": { room: "Lani's Curiosities", marker: "Lani" },
  "Jennaler's Wines": { room: "Waterfront Market", marker: "Jennaler" },
  "Toy Stall": { room: "Tanners Road", marker: "Tonya the Tinkerer" },
  "Candice's Candles": { room: "Bobbin Road South", marker: "Candice" },
  "Hallig's Street Food": { room: "Thadwick Square", marker: "Hallig" },
  // The Chef shop is in the Goose Inn Kitchen, run by Anron the Chef
  // (the Head Chef in The Delectable Dab Kitchen buys food, sells nothing).
  Chef: { room: "Goose Inn Kitchen", marker: "Anron the Chef" },
  "Bert's Gallery": { room: "Bert's Gallery" },
  "Souvenir Stall": { room: "Outer Market", marker: "Onjuan Nairal" },
  "Bogg's Antiques": { room: "Bogg's Antiques" },
  "Tommy Shoes Wines": { room: "Peacock Road Central", marker: "Tommy Shoes" },
  "Monocle Market": { room: "Peacock Road North", marker: "Morley" },
  "Francesca's Fruit Stall": { room: "Meggrit's Market", marker: "Francesca" },
  "Snilch's Watches": { room: "Meggrit's Market", marker: "Begram Snilch" },
  "Soap Shop": { room: "Soap Shop", marker: "Bubbles MacLeish" },
  "Henderson's Meat": {
    room: "Henderson's Meat Storehouse",
    marker: "Henderson",
  },
  "Cheese Shop": { room: "Unicorn Farm", marker: "Ralph Cyclops" },
  "Vase Stall": { room: "Lord's Road Central", marker: "Cid" },
  "Penny's Clockwork": { room: "Lord's Road East", marker: "Penny Palmer" },
  "Janessa's Delicacies": { room: "Merchants' Guild", marker: "Janessa Morage" },
  "Textiles Stall": { room: "Waterfront Market", marker: "Quinnis" },
  // The wiki puts the Cabbage Stall's Ignatius on Twiddle Corner, next door
  // to the Greengrocers room — the wiki is more up to date here than the
  // old BrighterFinder data, which had him in Greengrocers.
  "Cabbage Stall": { room: "Twiddle Corner", marker: "Ignatius" },
  "Pearl Stall": { room: "Peacock Road South", marker: "Pearl" },
  // Bounty boards and portal stones
  "Guild Bounty Board": {
    room: "Merchants' Guild",
    marker: "Guild Bounty Board",
  },
  // The Express board is the board in the South Player Market, the room
  // south of the Merchants' Guild; graph node 59 is the waypoint at the
  // room's north end, next to the board.
  "Express Bounty Board": {
    room: "South Player Market",
    marker: "Express Bounty Board",
  },
  "Crenopolis Market": {
    room: "Crenopolis Market",
    marker: "Crenopolis Market Portal Stone",
  },
  "Crenopolis Outskirts": {
    room: "Crenopolis Outskirts",
    marker: "Crenopolis Outskirts Portal Stone",
  },
};

// City Shortcut endpoint nodes that have no marker of their own (a street
// or den-door node, not a market): each stands in for the teleport spot, so
// its position is the shortcut's map glyph in that room. The node numbers
// are the `cityShortcut` edges in src/algorithm/nodes.js; the rooms are the
// shortcut's two locations from the wiki variant pages.
const SHORTCUT_ENDPOINTS = [
  { node: 107, shortcut: "Cellar", room: "Snag Alley" },
  { node: 80, shortcut: "Sewer", room: "Sludge Street" },
  { node: 48, shortcut: "Sewer", room: "Tanners Road" },
  { node: 67, shortcut: "Manhole", room: "Slant Street" },
];

// The marker segments are stored in the map image's own coordinate space
// (axes swapped relative to in-game coords). This affine transform to wiki
// in-game [x, y] was fitted against the gadget's room-linked marker
// segments (median residual < 1.5u) and cross-checked against entity
// points sharing a segment's link name (e.g. the Sewer Fiend glyphs sit on
// the Sewer Fiend entity points).
const segmentToWiki = ([px, py]) => [0.9994 * py + 0.226, 0.9977 * px + 1.422];

const round2 = (value) => Math.round(value * 100) / 100;

// Decode a JavaScript single-quoted string literal's escapes into the
// raw text it represents.
const decodeJsString = (raw) =>
  raw.replace(/\\(\\|'|"|n|r|t|b|f|v|0|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})/g, (match, escape) => {
    switch (escape[0]) {
      case "\\":
        return "\\";
      case "'":
        return "'";
      case '"':
        return '"';
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "v":
        return "\v";
      case "0":
        return "\0";
      case "x":
        return String.fromCharCode(parseInt(escape.slice(1), 16));
      case "u":
        return String.fromCharCode(parseInt(escape.slice(1), 16));
      default:
        return match;
    }
  });

/**
 * Extract the embedded GeoJSON from the wiki map gadget's JavaScript:
 * every JSON.parse('...') literal is parsed and classified by shape.
 * @param jsText The gadget JavaScript
 * @returns {{rooms: object[], entities: object[], segments: {coordinates: number[][], link: string}[]}} Room and entity features, plus the named marker segments
 */
export const extractGeojsonModules = (jsText) => {
  const rooms = [];
  const entities = [];
  const segments = [];
  const marker = "JSON.parse('";
  let from = 0;
  for (;;) {
    const start = jsText.indexOf(marker, from);
    if (start === -1) {
      break;
    }
    // Find the closing quote, skipping escaped characters.
    let end = start + marker.length;
    while (end < jsText.length) {
      if (jsText[end] === "\\") {
        end += 2;
        continue;
      }
      if (jsText[end] === "'") {
        break;
      }
      end += 1;
    }
    const raw = jsText.slice(start + marker.length, end);
    from = end + 1;
    let parsed;
    try {
      parsed = JSON.parse(decodeJsString(raw));
    } catch {
      continue;
    }
    // The marker segments are flat {coordinates, link} objects (no
    // geometry): the wiki's named map glyphs, one short segment each. They
    // arrive as a bare array, not a FeatureCollection.
    const isSegment = (item) =>
      Array.isArray(item?.coordinates) && typeof item.link === "string";
    if (
      parsed?.type === "FeatureCollection" &&
      Array.isArray(parsed.features) &&
      parsed.features.length > 0
    ) {
      const first = parsed.features[0];
      if (isSegment(first)) {
        segments.push(...parsed.features);
      } else if (first.geometry?.type === "Polygon") {
        rooms.push(...parsed.features);
      } else if (first.geometry?.type === "Point") {
        entities.push(...parsed.features);
      }
    } else if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(isSegment)
    ) {
      segments.push(...parsed);
    }
  }
  return { rooms, entities, segments };
};

// Polygon area centroid (shoelace formula) of the outer ring.
const polygonCentroid = (coordinates) => {
  const ring = coordinates[0];
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const cross = x1 * y2 - x2 * y1;
    area2 += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(area2) < 1e-9) {
    const xs = ring.map((point) => point[0]);
    const ys = ring.map((point) => point[1]);
    return [
      xs.reduce((a, b) => a + b, 0) / xs.length,
      ys.reduce((a, b) => a + b, 0) / ys.length,
    ];
  }
  return [cx / (3 * area2), cy / (3 * area2)];
};

/**
 * Resolve every market, both bounty boards and both portals to a wiki
 * in-game [x, y] position. Nothing is guessed: anything unresolved is
 * reported in `unresolved` and left out of `entries`.
 * @param geojson {rooms, entities} from {@link extractGeojsonModules}
 * @param mapping Market name -> {room, marker?} (defaults to MAPPING)
 * @returns {{entries: {name: string, node: number, position: number[], note: string}[], unresolved: string[]}}
 */
export const resolvePositions = (geojson, mapping = MAPPING) => {
  const roomByName = new Map(
    geojson.rooms.map((room) => [room.properties?.name, room]),
  );
  const entitiesByName = new Map();
  for (const entity of geojson.entities) {
    const name = entity.properties?.name;
    if (!name) {
      continue;
    }
    if (!entitiesByName.has(name)) {
      entitiesByName.set(name, []);
    }
    entitiesByName.get(name).push(entity);
  }

  const expected = [
    ...Object.values(markets),
    bountyBoard,
    expressBountyBoard,
    ...Object.values(portals),
  ];
  const unresolved = [];
  const entries = [];

  for (const { name, node } of expected) {
    const entry = mapping[name];
    if (!entry) {
      unresolved.push(`${name} (node ${node}): no entry in MAPPING`);
      continue;
    }
    if (entry.marker) {
      const candidates = entitiesByName.get(entry.marker) ?? [];
      // Some NPCs appear twice (e.g. a shopkeeper and an event appearance
      // in Hammerstrike Hall): the shopkeeper is the icon-merchant one.
      const merchants = candidates.filter((entity) =>
        (entity.properties?.classes ?? []).includes("icon-merchant"),
      );
      const chosen =
        candidates.length === 1
          ? candidates[0]
          : merchants.length === 1
            ? merchants[0]
            : null;
      if (!chosen) {
        unresolved.push(
          `${name} (node ${node}): marker "${entry.marker}" ` +
            `has ${candidates.length} entities, ${merchants.length} merchant — ambiguous`,
        );
        continue;
      }
      entries.push({
        name,
        node,
        position: chosen.geometry.coordinates.map(round2),
        note: `marker "${entry.marker}" in ${entry.room}`,
      });
      continue;
    }
    const room = roomByName.get(entry.room);
    if (!room) {
      unresolved.push(
        `${name} (node ${node}): room "${entry.room}" not in wiki GeoJSON`,
      );
      continue;
    }
    if (room.geometry?.type !== "Polygon") {
      unresolved.push(
        `${name} (node ${node}): room "${entry.room}" is not a polygon`,
      );
      continue;
    }
    entries.push({
      name,
      node,
      position: polygonCentroid(room.geometry.coordinates).map(round2),
      note: "room centre",
    });
  }

  entries.sort((a, b) => a.node - b.node);
  return { entries, unresolved };
};

// Ray-cast point-in-polygon test against a ring's outer boundary.
const pointInRing = (point, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};

/**
 * Resolve the City Shortcut endpoint nodes without a marker of their own
 * ({@link SHORTCUT_ENDPOINTS}) to the shortcut's map glyph in its room.
 * Each shortcut has exactly two glyphs ("<Name> City Shortcut"); the one
 * whose midpoint lies in the endpoint's room is that endpoint's spot.
 * Nothing is guessed: anything unresolved is reported in `unresolved`.
 * @param geojson {rooms, entities, segments} from {@link extractGeojsonModules}
 * @param endpoints [{node: number, shortcut: string, room: string}] (defaults to SHORTCUT_ENDPOINTS)
 * @returns {{entries: {name: string, node: number, position: number[], note: string}[], unresolved: string[]}}
 */
export const resolveShortcutEndpoints = (
  geojson,
  endpoints = SHORTCUT_ENDPOINTS,
) => {
  const roomByName = new Map(
    geojson.rooms.map((room) => [room.properties?.name, room]),
  );
  const unresolved = [];
  const entries = [];

  for (const { node, shortcut, room } of endpoints) {
    const glyphs = geojson.segments.filter(
      (segment) => segment.link === `${shortcut} City Shortcut`,
    );
    if (glyphs.length !== 2) {
      unresolved.push(
        `node ${node}: "${shortcut} City Shortcut" has ${glyphs.length} glyphs, expected 2`,
      );
      continue;
    }
    const roomFeature = roomByName.get(room);
    if (!roomFeature || roomFeature.geometry?.type !== "Polygon") {
      unresolved.push(`node ${node}: room "${room}" not in wiki GeoJSON`);
      continue;
    }
    const ring = roomFeature.geometry.coordinates[0];
    const inside = glyphs.map((glyph) => {
      const mid = [
        (glyph.coordinates[0][0] + glyph.coordinates[1][0]) / 2,
        (glyph.coordinates[0][1] + glyph.coordinates[1][1]) / 2,
      ];
      return {
        wiki: segmentToWiki(mid),
        inRoom: pointInRing(segmentToWiki(mid), ring),
      };
    });
    const matches = inside.filter((g) => g.inRoom);
    if (matches.length !== 1) {
      unresolved.push(
        `node ${node}: ${matches.length} of the "${shortcut}" glyphs are in ${room}, expected 1`,
      );
      continue;
    }
    entries.push({
      name: room,
      node,
      position: matches[0].wiki.map(round2),
      note: `${shortcut} City Shortcut glyph (teleport spot)`,
    });
  }

  entries.sort((a, b) => a.node - b.node);
  return { entries, unresolved };
};

const main = async () => {
  const response = await fetch(GADGET_URL);
  if (!response.ok) {
    throw new Error(`Fetching ${GADGET_URL} failed: ${response.status}`);
  }
  const geojson = extractGeojsonModules(await response.text());
  if (geojson.rooms.length === 0 || geojson.entities.length === 0) {
    throw new Error(
      `No GeoJSON found in ${GADGET_URL}: ` +
        `${geojson.rooms.length} rooms, ${geojson.entities.length} entities`,
    );
  }
  const markets = resolvePositions(geojson);
  const shortcuts = resolveShortcutEndpoints(geojson);
  const entries = [...markets.entries, ...shortcuts.entries].sort(
    (a, b) => a.node - b.node,
  );
  const unresolved = [...markets.unresolved, ...shortcuts.unresolved];

  if (unresolved.length > 0) {
    console.error("Could not resolve positions for:");
    for (const line of unresolved) {
      console.error(`  - ${line}`);
    }
    process.exit(1);
  }

  const lines = entries.map(
    (entry) =>
      `  ${entry.node}: [${entry.position.join(", ")}], // ${entry.name} — ${entry.note}`,
  );

  const header = `// Generated by \`node scripts/generateNodePositions.mjs\` — do not edit by hand.
// Source: ${GADGET_URL}
// Fetched: ${new Date().toISOString()}
// Coordinates are wiki in-game [x, y], rounded to 2 decimals.
// A position is the room centre (polygon centroid) unless the comment says
// it is a shop marker (the shopkeeper NPC's marker inside the room) or a
// City Shortcut glyph (the teleport spot for a shortcut endpoint node).
export const nodePositions = {
${lines.join("\n")}
};
`;

  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "algorithm",
    "nodePositions.js",
  );
  writeFileSync(outPath, header);
  console.log(`Wrote ${outPath} (${entries.length} positions)`);
};

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
