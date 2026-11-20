// Fetches the Brighter Shores wiki's map data and writes
// src/algorithm/nodePositions.js: a node number -> [x, y] map in wiki
// in-game coords for every market, both bounty boards, the two portal
// stones and all ten City Shortcut endpoint nodes. The spot positions come
// from TELEPORT_SPOTS below (measured in-game; the wiki's map glyphs sit a
// few units off the real teleport triggers), not from the wiki data. Also
// The ten crime den rooms are graph nodes too (see `denRooms` in
// src/algorithm/nodes.js): their positions are the wiki polygon centroids,
// used for routing through raided dens and for the route map's debug
// overlay. So are the quest rooms (see `questRooms`), whose passages open
// when a quest is complete. Every other graph node is a waypoint at a
// doorway (WAYPOINT_DOORS), so the route map draws walks along the streets.
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
import { bountyBoard, crimeDens, denRooms, expressBountyBoard, markets, portals, questRooms } from "../src/algorithm/nodes.js";

export const GADGET_URL =
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

// All ten City Shortcut endpoint nodes: the spot nodes (120-125,
// 137-140) of the `cityShortcut` edges in
// src/algorithm/nodes.js; the rooms are the shortcut's two locations from
// the wiki variant pages. Used to resolve each endpoint to its map glyph in
// a room (a cross-check against TELEPORT_SPOTS, which is what
// nodePositions.js actually gets).
const SHORTCUT_SPOTS = [
  { node: 138, shortcut: "Sewer", room: "Tanners Road" },
  { node: 140, shortcut: "Manhole", room: "Slant Street" },
  { node: 139, shortcut: "Sewer", room: "Sludge Street" },
  { node: 137, shortcut: "Cellar", room: "Snag Alley" },
  { node: 120, shortcut: "Cellar", room: "Unicorn Farm" },
  { node: 121, shortcut: "Painting", room: "Fillan's Living Room" },
  { node: 122, shortcut: "Manhole", room: "Dusty Nook" },
  { node: 123, shortcut: "Trapdoor", room: "Council Office" },
  { node: 124, shortcut: "Trapdoor", room: "The Frog and Barnacle" },
  { node: 125, shortcut: "Painting", room: "Bert's Gallery" },
];

// The teleport spots, measured in-game (2026-11-18) except where noted.
// They override the wiki's map glyphs for all ten City Shortcut endpoint
// nodes: the glyphs sit a few units off the real teleport triggers, and
// routing walks to these positions.
const TELEPORT_SPOTS = [
  { node: 138, shortcut: "Sewer", room: "Tanners Road", position: [412, 97] },
  { node: 140, shortcut: "Manhole", room: "Slant Street", position: [403, 20] },
  {
    // Tile data (the in-game reading [346, 3] was 4u off).
    node: 139,
    shortcut: "Sewer",
    room: "Sludge Street",
    position: [346.5, 7],
    note: "Sewer City Shortcut spot (tile data)",
  },
  { node: 137, shortcut: "Cellar", room: "Snag Alley", position: [365, 58] },
  { node: 120, shortcut: "Cellar", room: "Unicorn Farm", position: [245, 37] },
  { node: 121, shortcut: "Painting", room: "Fillan's Living Room", position: [387, -29] },
  { node: 122, shortcut: "Manhole", room: "Dusty Nook", position: [326, 72] },
  { node: 123, shortcut: "Trapdoor", room: "Council Office", position: [440, 23] },
  { node: 124, shortcut: "Trapdoor", room: "The Frog and Barnacle", position: [364, 97] },
  { node: 125, shortcut: "Painting", room: "Bert's Gallery", position: [457, 50] },
];
// Graph waypoints are doorways: two wiki room outlines one unit apart for a
// short stretch. Each node is matched to its doorway by its edges (both ends
// must touch a common room, times fit ~2.62 units/s); see the README.
const WAYPOINT_DOORS = [
  { node: 1, door: ["Crenopolis Outskirts Portal Stone", "Cyclops East Pass"], position: [290, 57.5] },
  { node: 2, door: ["Stony Ravine", "Cyclops East Pass"], position: [286.5, 53] },
  { node: 3, door: ["Stony Gorge", "Stony Ravine"], position: [279, 57.5] },
  { node: 4, door: ["Stony Canyon", "Stony Gorge"], position: [265.5, 61] },
  { node: 5, door: ["Cyclops Canyon", "Stony Canyon"], position: [252.5, 61] },
  { node: 6, door: ["Cyclops Canyon", "Unicorn Farm"], position: [249, 57.5] },
  { node: 7, door: ["Unicorn Farm", "Cyclops Store Cave"], position: [255.5, 51] },
  { node: 9, door: ["Cyclops East Pass", "Road to Crenopolis"], position: [294, 48.5] },
  { node: 10, door: ["Road to Crenopolis", "Rockbird Clearing"], position: [296.5, 40.5] },
  { node: 11, door: ["Fortunehold Meadow", "Rockbird Clearing"], position: [296, 21.5] },
  { node: 12, door: ["Fortunehold Meadow", "Fortunehold Farm"], position: [301.5, 4.5] },
  { node: 14, door: ["Road to Crenopolis", "West Gate"], position: [300.5, 45] },
  { node: 15, door: ["West Gate", "Lord's Road West"], position: [314.5, 45] },
  { node: 17, door: ["Cobble Corner", "Lord's Road West"], position: [320.5, 51.5] },
  { node: 19, door: ["Cobble Corner", "Twiddle Corner"], position: [325.5, 61.5] },
  { node: 20, door: ["Twiddle Corner", "Greengrocers"], position: [339.5, 57.5] },
  { node: 22, door: ["Dusty Alley", "Twiddle Corner"], position: [338, 65.5] },
  { node: 23, door: ["Dusty Alley", "Dusty Corner"], position: [338, 74.5] },
  { node: 24, door: ["Dusty Corner", "Morose Lane West"], position: [343.5, 78] },
  { node: 25, door: ["Lani's Curiosities", "Morose Lane West"], position: [356, 80.5] },
  { node: 27, door: ["Morose Lane East", "Morose Lane West"], position: [360.5, 78] },
  { node: 28, door: ["Morose Lane East", "Thimble Lane"], position: [370.5, 78] },
  { node: 29, door: ["Geld Family Residence", "Thimble Lane"], position: [375, 81.5] },
  { node: 30, door: ["Waterfront Market", "Geld Family Residence"], position: [375, 88.5] },
  { node: 32, door: ["Waterfront Market", "Geld Family Logistics"], position: [382, 89.5] },
  { node: 33, door: ["Geld Family Logistics", "Thimble Lane"], position: [382, 80.5] },
  { node: 34, door: ["Waterfront Market", "Waterfront"], position: [388.5, 95] },
  { node: 35, door: ["Waterfront", "Tanners Road"], position: [404.5, 95] },
  { node: 37, door: ["Bobbin Road South", "Waterfront"], position: [395.5, 89.5] },
  { node: 39, door: ["Bobbin Road South", "Bobbin Road North"], position: [395, 65.5] },
  { node: 40, door: ["Thadwick Square", "Bobbin Road North"], position: [395, 53.5] },
  { node: 42, door: ["Thadwick Square", "Goose Inn Bar"], position: [387, 53.5] },
  { node: 43, door: ["Goose Inn Kitchen", "Goose Inn Bar"], position: [387, 66.5] },
  { node: 45, door: ["Leatherworks", "Bobbin Road North"], position: [399.5, 58] },
  { node: 46, door: ["Leatherworks", "Ratmore Rise"], position: [407.5, 59.5] },
  { node: 47, door: ["Ratmore Road", "Ratmore Rise"], position: [416.5, 75] },
  { node: 48, door: ["Ratmore Road", "Tanners Road"], position: [419, 89.5] },
  { node: 49, door: ["Ratmore Road", "Market Chambers"], position: [425.5, 70] },
  { node: 50, door: ["Market Chambers", "South Player Market"], position: [431, 64.5] },
  { node: 51, door: ["South Player Market", "Oscen's Warehouse"], position: [423.5, 59.5] },
  { node: 52, door: ["Ratmore Road", "Oscen's Warehouse"], position: [421, 66.5] },
  { node: 55, door: ["Crenopolis Market Portal Stone", "East Player Market"], position: [443.5, 56.5] },
  { node: 56, door: ["South Player Market", "East Player Market"], position: [437.5, 51.5] },
  { node: 58, door: ["East Player Market", "Bert's Gallery"], position: [448.5, 48] },
  { node: 60, door: ["West Player Market", "Outer Market"], position: [414.5, 45] },
  { node: 62, door: ["Slant Street Cart House", "West Player Market"], position: [416.5, 36.5] },
  { node: 63, door: ["Slant Street Cart House", "Slant Street"], position: [405.5, 30.5] },
  { node: 64, door: ["Dilapidated Warehouse", "West Player Market"], position: [420.5, 30.5] },
  { node: 65, door: ["Dilapidated Warehouse", "Slant Street"], position: [415.5, 26] },
  { node: 67, door: ["Peacock Road South", "Slant Street"], position: [399.5, 23] },
  { node: 68, door: ["Peacock Road South", "Peacock Road Central"], position: [394, 18.5] },
  { node: 70, door: ["Peacock Road North", "Peacock Road Central"], position: [394, -2.5] },
  { node: 72, door: ["Hopton Corner", "Lord's Road West"], position: [329, 39.5] },
  { node: 73, door: ["Hopton Corner", "Rat Alley"], position: [336, 30.5] },
  { node: 74, door: ["Murkwell Court", "Rat Alley"], position: [336, 18.5] },
  { node: 75, door: ["Murkwell Court", "Meggrit's Market"], position: [331.5, 14] },
  { node: 78, door: ["Murkwell Court", "Murkwell Lane"], position: [343.5, 14] },
  { node: 79, door: ["Dawkin Lane", "Murkwell Lane"], position: [358.5, 14.5] },
  { node: 80, door: ["Dawkin Lane", "Soap Shop"], position: [362.5, 10.5] },
  { node: 82, door: ["East Player Market", "Henderson's Meat Storehouse"], position: [448.5, 35] },
  { node: 87, door: ["Lord's Road Central", "Lord's Road West"], position: [334.5, 45] },
  { node: 88, door: ["Lord's Road Central", "Lord's Road East"], position: [354.5, 45] },
  { node: 89, door: ["Lord's Road New", "Lord's Road East"], position: [371.5, 45] },
  { node: 90, door: ["Lord's Road New", "Thadwick Square"], position: [382.5, 45] },
  { node: 91, door: ["Peacock Road South", "Thadwick Square"], position: [394, 36.5] },
  { node: 92, door: ["Greengrocers", "Lord's Road Central"], position: [340, 49.5] },
  { node: 94, door: ["Bobbin Road South", "Thimble Lane"], position: [390.5, 78] },
  { node: 95, door: ["Thadwick Square", "Outer Market"], position: [399.5, 45] },
  { node: 96, door: ["North Player Market", "East Player Market"], position: [437.5, 33.5] },
  { node: 97, door: ["North Player Market", "West Player Market"], position: [425.5, 33.5] },
  { node: 98, door: ["North Player Market", "Merchants' Guild"], position: [434, 36.5] },
  { node: 99, door: ["West Player Market", "Merchants' Guild"], position: [425.5, 42.5] },
  { node: 100, door: ["South Player Market", "Merchants' Guild"], position: [434, 48.5] },
  { node: 101, door: ["Slant Street", "Bogg's Antiques"], position: [406.5, 17.5] },
  { node: 105, door: ["Meggrit's Market", "Abandoned Alleyway"], position: [318.5, 12.5] },
  { node: 106, door: ["Fortunehold Farm", "Abandoned Alleyway"], position: [309.5, 7.5] },
  { node: 107, door: ["Four Winds Backroom", "Snag Alley"], position: [358.5, 58] },
  { node: 108, door: ["Four Winds Backroom", "Four Winds Bar"], position: [355.5, 64.5] },
  { node: 109, door: ["Four Winds Side Room", "Snag Alley"], position: [363.5, 68.5] },
  { node: 110, door: ["Four Winds Bar", "Four Winds Side Room"], position: [360.5, 71] },
  { node: 111, door: ["Lord's Road East", "Snag Alley"], position: [364, 49.5] },
  { node: 112, door: ["Morose Lane West", "Four Winds Bar"], position: [356, 74.5] },
  { node: 113, door: ["The Quill Club", "Peacock Road Central"], position: [389.5, 9.5] },
  { node: 114, door: ["Dawkin Court", "The Quill Club"], position: [382.5, 9.5] },
  { node: 115, door: ["Dawkin Court", "Gillad's House"], position: [378, 4.5] },
  { node: 116, door: ["Gillad's House", "Peacock Road Central"], position: [389.5, 1.5] },
  { node: 117, door: ["Dawkin Lane", "Dawkin Court"], position: [371.5, 15] },
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

// Shortest distance from a point to a ring's edges (the ring is closed).
const distToRing = (point, ring) => {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point[0] - x1) * dx + (point[1] - y1) * dy) / (dx * dx + dy * dy),
      ),
    );
    best = Math.min(
      best,
      Math.hypot(point[0] - (x1 + t * dx), point[1] - (y1 + t * dy)),
    );
  }
  return best;
};

// Teleport spots sit at doorways: some lie inside their room, some just
// outside it, on the boundary between rooms. A glyph counts as in its room
// when it is inside the ring or within this distance of it. The other
// endpoint's glyph is always 80u+ away, so the "exactly one" check below
// stays unambiguous.
const SPOT_BOUNDARY_TOLERANCE = 3;

/**
 * Resolve every City Shortcut endpoint node ({@link SHORTCUT_SPOTS}) to the
 * shortcut's map glyph in its room. Each shortcut has exactly two glyphs
 * ("<Name> City Shortcut"); the one inside the endpoint's room, or on/near
 * its ring (see SPOT_BOUNDARY_TOLERANCE), is that endpoint's spot — spots
 * sit at doorways, so they can lie just outside the room polygon. Nothing
 * is guessed: anything unresolved is reported in `unresolved`.
 * @param geojson {rooms, entities, segments} from {@link extractGeojsonModules}
 * @param endpoints [{node: number, shortcut: string, room: string}] (defaults to SHORTCUT_SPOTS)
 * @returns {{entries: {name: string, node: number, position: number[], note: string}[], unresolved: string[]}}
 */
export const resolveShortcutEndpoints = (
  geojson,
  endpoints = SHORTCUT_SPOTS,
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
      const wiki = segmentToWiki(mid);
      return {
        wiki,
        inRoom:
          pointInRing(wiki, ring) ||
          distToRing(wiki, ring) <= SPOT_BOUNDARY_TOLERANCE,
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

/**
 * Resolve every crime den's rooms to their wiki in-game [x, y] positions
 * (the room polygon centroid). These become the positions of the den room
 * nodes (see `denRooms` in src/algorithm/nodes.js), used for routing
 * through raided dens and for the route map's debug overlay. Nothing is
 * guessed: anything unresolved is reported in `unresolved`.
 * @param geojson {rooms} from {@link extractGeojsonModules}
 * @param dens Dens from src/algorithm/nodes.js (defaults to crimeDens)
 * @returns {{entries: {den: string, room: string, position: number[]}[], unresolved: string[]}}
 */
export const resolveDenRooms = (geojson, dens = crimeDens) => {
  const roomByName = new Map(
    geojson.rooms.map((room) => [room.properties?.name, room]),
  );
  const entries = [];
  const unresolved = [];
  for (const den of dens) {
    for (const room of den.rooms) {
      const feature = roomByName.get(room);
      if (!feature || feature.geometry?.type !== "Polygon") {
        unresolved.push(
          `den ${den.key}: room "${room}" not in wiki GeoJSON`,
        );
        continue;
      }
      entries.push({
        den: den.key,
        room,
        position: polygonCentroid(feature.geometry.coordinates).map(round2),
      });
    }
  }
  return { entries, unresolved };
};

/**
 * Resolve every quest room to its wiki in-game [x, y] position (the room
 * polygon centroid). These become the positions of the quest room nodes
 * (see `questRooms` in src/algorithm/nodes.js), used for routing through
 * opened passages and drawn by the route map. Nothing is guessed: anything
 * unresolved is reported in `unresolved`.
 * @param geojson {rooms, entities} from {@link extractGeojsonModules}
 * @param rooms Quest rooms from src/algorithm/nodes.js (defaults to questRooms)
 * @returns {{entries: {quest: string, room: string, position: number[]}[], unresolved: string[]}}
 */
export const resolveQuestRooms = (geojson, rooms = questRooms) => {
  const roomByName = new Map(
    geojson.rooms.map((room) => [room.properties?.name, room]),
  );
  const entries = [];
  const unresolved = [];
  for (const entry of rooms) {
    const feature = roomByName.get(entry.room);
    if (!feature || feature.geometry?.type !== "Polygon") {
      unresolved.push(
        `quest ${entry.quest}: room "${entry.room}" not in wiki GeoJSON`,
      );
      continue;
    }
    entries.push({
      quest: entry.quest,
      room: entry.room,
      position: polygonCentroid(feature.geometry.coordinates).map(round2),
    });
  }
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
  const marketEntries = resolvePositions(geojson);
  const denRoomEntries = resolveDenRooms(geojson);
  const questRoomEntries = resolveQuestRooms(geojson);
  // The den room nodes (denRooms in src/algorithm/nodes.js) sit at their
  // rooms' wiki polygon centres. So do the quest room nodes (questRooms).
  const denNodeByRoom = new Map(
    denRooms.map((room) => [`${room.den}:${room.room}`, room.node]),
  );
  const questNodeByRoom = new Map(
    questRooms.map((room) => [`${room.quest}:${room.room}`, room.node]),
  );
  // The teleport spots come from TELEPORT_SPOTS, not from the wiki's map
  // glyphs.
  const entries = [
    ...marketEntries.entries,
    ...WAYPOINT_DOORS.map((waypoint) => ({
      name: waypoint.door.join(" / "),
      node: waypoint.node,
      position: waypoint.position,
      note: "doorway (wiki room outlines)",
    })),
    ...TELEPORT_SPOTS.map((spot) => ({
      name: spot.room,
      node: spot.node,
      position: spot.position,
      note: spot.note ?? `${spot.shortcut} City Shortcut spot (measured in-game)`,
    })),
    ...denRoomEntries.entries.map((entry) => ({
      name: entry.room,
      node: denNodeByRoom.get(`${entry.den}:${entry.room}`),
      position: entry.position,
      note: "crime den room centre",
    })),
    ...questRoomEntries.entries.map((entry) => ({
      name: entry.room,
      node: questNodeByRoom.get(`${entry.quest}:${entry.room}`),
      position: entry.position,
      note: "quest room centre",
    })),
  ].sort((a, b) => a.node - b.node);
  const unresolved = [
    ...marketEntries.unresolved,
    ...denRoomEntries.unresolved,
    ...questRoomEntries.unresolved,
    ...denRoomEntries.entries
      .filter((entry) => !denNodeByRoom.has(`${entry.den}:${entry.room}`))
      .map(
        (entry) =>
          `den ${entry.den}: room "${entry.room}" has no node in denRooms`,
      ),
    ...questRoomEntries.entries
      .filter((entry) => !questNodeByRoom.has(`${entry.quest}:${entry.room}`))
      .map(
        (entry) =>
          `quest ${entry.quest}: room "${entry.room}" has no node in questRooms`,
      ),
  ];

  if (unresolved.length > 0) {
    console.error("Could not resolve positions for:");
    for (const line of unresolved) {
      console.error(`  - ${line}`);
    }
    process.exit(1);
  }

  const formatEntry = (entry) =>
    `  ${entry.node}: [${entry.position.join(", ")}], // ${entry.name} — ${entry.note}`;

  const header = `// Generated by \`node scripts/generateNodePositions.mjs\` — do not edit by hand.
// Source: ${GADGET_URL}
// Fetched: ${new Date().toISOString()}
// Coordinates are wiki in-game [x, y], rounded to 2 decimals.
// A position is the room centre (polygon centroid) unless the comment says
// it is a shop marker (the shopkeeper NPC's marker inside the room), a
// crime den room centre, a quest room centre, a City Shortcut spot
// (measured in-game; overrides the wiki's map glyph), or a doorway.
export const nodePositions = {
${entries.map(formatEntry).join("\n")}
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
