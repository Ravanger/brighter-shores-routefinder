// Fetches BrighterFinder's room database and writes src/algorithm/nodePositions.js:
// a node number -> [x, y] map in BrighterFinder Tile space for every market,
// the bounty board and the two portal stones.
//
// Usage: node scripts/generateNodePositions.mjs
//
// The positions come from an explicit name mapping below, resolved against the
// wiki (brightershoreswiki.org) for which NPC runs each shop and which room it
// is in. Nothing is guessed: if a name, room or marker cannot be resolved the
// script prints what is missing and exits non-zero.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bountyBoard, markets, portals } from "../src/algorithm/nodes.js";

const LOOKUP_URL = "https://brighterfinder.com/data/lookup_table.json";

// Market name (as in src/algorithm/nodes.js) -> where it lives in the
// BrighterFinder lookup table. { room } uses the room's centre;
// { room, marker } uses that marker's position inside the room (the
// shopkeeper NPC for a shop, which is more precise than the room centre).
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
  // The wiki puts the Cabbage Stall on Twiddle Corner; BrighterFinder puts
  // the Ignatius marker in the next-door Greengrocers room. The marker tile
  // is Ignatius either way, so it is used as-is.
  "Cabbage Stall": { room: "Greengrocers", marker: "Ignatius" },
  "Pearl Stall": { room: "Peacock Road South", marker: "Pearl" },
  // Bounty board and portal stones
  "Guild Bounty Board": {
    room: "Merchants' Guild",
    marker: "Guild Bounty Board",
  },
  "Crenopolis Market": { room: "Crenopolis Market Portal Stone" },
  "Crenopolis Outskirts": { room: "Crenopolis Outskirts Portal Stone" },
};

const round2 = (value) => Math.round(value * 100) / 100;

const main = async () => {
  const response = await fetch(LOOKUP_URL);
  if (!response.ok) {
    throw new Error(`Fetching ${LOOKUP_URL} failed: ${response.status}`);
  }
  const { rooms } = await response.json();
  const roomByName = new Map(rooms.map((room) => [room.name, room]));

  const expected = [
    ...Object.values(markets),
    bountyBoard,
    ...Object.values(portals),
  ];
  const unresolved = [];
  const entries = [];

  for (const { name, node } of expected) {
    const mapping = MAPPING[name];
    if (!mapping) {
      unresolved.push(`${name} (node ${node}): no entry in MAPPING`);
      continue;
    }
    const room = roomByName.get(mapping.room);
    if (!room) {
      unresolved.push(
        `${name} (node ${node}): room "${mapping.room}" not in lookup table`,
      );
      continue;
    }
    if (mapping.marker) {
      const marker = room.markers.find(
        (entry) => entry.properties.name === mapping.marker,
      );
      if (!marker) {
        unresolved.push(
          `${name} (node ${node}): marker "${mapping.marker}" not in room "${mapping.room}"`,
        );
        continue;
      }
      entries.push({
        name,
        node,
        position: marker.geometry.coordinates.map(round2),
        note: `marker "${mapping.marker}" in ${mapping.room}`,
      });
    } else {
      entries.push({
        name,
        node,
        position: room.center.map(round2),
        note: "room centre",
      });
    }
  }

  if (unresolved.length > 0) {
    console.error("Could not resolve positions for:");
    for (const line of unresolved) {
      console.error(`  - ${line}`);
    }
    process.exit(1);
  }

  entries.sort((a, b) => a.node - b.node);
  const lines = entries.map(
    (entry) =>
      `  ${entry.node}: [${entry.position.join(", ")}], // ${entry.name} — ${entry.note}`,
  );

  const header = `// Generated by \`node scripts/generateNodePositions.mjs\` — do not edit by hand.
// Source: ${LOOKUP_URL}
// Fetched: ${new Date().toISOString()}
// Coordinates are BrighterFinder Tile space, rounded to 2 decimals.
// A position is the room centre unless the comment says it is a shop marker
// (the shopkeeper NPC's marker inside the room).
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

main();
