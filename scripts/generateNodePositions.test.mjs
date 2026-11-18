import test from "node:test";
import assert from "node:assert/strict";
import {
  extractGeojsonModules,
  resolvePositions,
  resolveShortcutEndpoints,
} from "./generateNodePositions.mjs";

// A synthetic slice of the gadget bundle: the data modules are
// JSON.parse('...') literals, plus an unrelated one that must be ignored.
const bundle = `
  582:e=>{"use strict";e.exports=JSON.parse('{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Greengrocers","category":"Room","episode":"Episode 1"},"geometry":{"type":"Polygon","coordinates":[[[340,53],[342,53],[342,55],[340,55],[340,53]]]}}]}')},
  207:e=>{"use strict";e.exports=JSON.parse('{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Bubbles MacLeish","category":"Entity","size":[1,1],"classes":["icon-merchant"]},"geometry":{"type":"Point","coordinates":[360,8]}},{"type":"Feature","properties":{"name":"Hermar","category":"Entity","size":[1,1],"classes":["icon-merchant"]},"geometry":{"type":"Point","coordinates":[319,58]}},{"type":"Feature","properties":{"name":"Hermar","category":"Entity","size":[1,1],"classes":["icon-talk","theme-merchant"]},"geometry":{"type":"Point","coordinates":[474,16]}}]}')},
  314:e=>{"use strict";e.exports=JSON.parse('[{"coordinates":[[0,100],[2,104]],"link":"Cellar City Shortcut"},{"coordinates":[[30,50],[32,54]],"link":"Cellar City Shortcut"}]')},
  999:e=>{"use strict";e.exports=JSON.parse('{"some":"config"}')},
`;

test("extracts rooms and entities from the gadget JS by shape", () => {
  const { rooms, entities } = extractGeojsonModules(bundle);

  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].properties.name, "Greengrocers");
  assert.equal(entities.length, 3);
  assert.deepEqual(
    entities.map((entity) => entity.properties.name),
    ["Bubbles MacLeish", "Hermar", "Hermar"],
  );
});

test("resolves markers and room centres from the wiki GeoJSON", () => {
  const geojson = extractGeojsonModules(bundle);
  const { entries, unresolved } = resolvePositions(geojson, {
    "Soap Shop": { room: "Soap Shop", marker: "Bubbles MacLeish" },
    "Hermar's Homeware": { room: "Cobble Corner", marker: "Hermar" },
    Greengrocers: { room: "Greengrocers" },
  });

  // The real MAPPING has 30 entries; a partial mapping leaves the rest
  // unresolved, which is exactly the failure the generator must report.
  assert.ok(unresolved.length > 0);
  assert.deepEqual(
    entries.map((entry) => [entry.node, entry.position]),
    [
      [18, [319, 58]],
      [21, [341, 54]],
      [81, [360, 8]],
    ],
  );
});

test("picks the shopkeeper when an NPC appears twice", () => {
  const geojson = extractGeojsonModules(bundle);
  const { entries, unresolved } = resolvePositions(geojson, {
    "Hermar's Homeware": { room: "Cobble Corner", marker: "Hermar" },
  });

  // Hermar the merchant at [319, 58], not the Hammerstrike Hall talk NPC.
  assert.deepEqual(
    entries.map((entry) => entry.position),
    [[319, 58]],
  );
  assert.ok(!unresolved.some((line) => line.includes("Hermar's Homeware")));
});

test("reports unresolved positions instead of guessing", () => {
  const geojson = extractGeojsonModules(bundle);
  const { entries, unresolved } = resolvePositions(geojson, {
    "Soap Shop": { room: "Soap Shop", marker: "No Such NPC" },
    "Hermar's Homeware": { room: "No Such Room" },
  });

  assert.deepEqual(entries, []);
  assert.equal(unresolved.length, 31); // every expected market/board/portal
  assert.ok(unresolved.some((line) => /Soap Shop.*No Such NPC/.test(line)));
  assert.ok(
    unresolved.some((line) => /Hermar's Homeware.*No Such Room/.test(line)),
  );
});

// The fixture's Cellar glyphs transform to wiki [102.16, 2.42] and
// [52.19, 32.35]; only the first lies in a room of the fixture, so it is
// the one that can be resolved.
test("resolves shortcut endpoint nodes to their glyph in the room", () => {
  const geojson = extractGeojsonModules(bundle);

  assert.equal(geojson.segments.length, 2);

  const { entries, unresolved } = resolveShortcutEndpoints(geojson, [
    { node: 107, shortcut: "Cellar", room: "No Such Room" },
  ]);
  assert.deepEqual(entries, []);
  assert.equal(unresolved.length, 1);

  // A room containing the first glyph's transformed midpoint resolves it.
  const withRoom = { ...geojson };
  withRoom.rooms.push({
    properties: { name: "Snag Alley" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [100, 0],
          [105, 0],
          [105, 5],
          [100, 5],
          [100, 0],
        ],
      ],
    },
  });
  const resolved = resolveShortcutEndpoints(withRoom, [
    { node: 107, shortcut: "Cellar", room: "Snag Alley" },
  ]);
  assert.deepEqual(resolved.unresolved, []);
  assert.deepEqual(resolved.entries, [
    {
      name: "Snag Alley",
      node: 107,
      position: [102.16, 2.42],
      note: "Cellar City Shortcut glyph (teleport spot)",
    },
  ]);
});

test("reports shortcut endpoints it cannot resolve", () => {
  const geojson = extractGeojsonModules(bundle);
  const { entries, unresolved } = resolveShortcutEndpoints(geojson, [
    // No glyphs for this shortcut name.
    { node: 48, shortcut: "Missing", room: "Snag Alley" },
  ]);
  assert.deepEqual(entries, []);
  assert.equal(unresolved.length, 1);
  assert.ok(/expected 2/.test(unresolved[0]));
});

// Spots sit at doorways: a glyph just outside its room's ring (within the
// boundary tolerance) still resolves to that room.
test("resolves a spot glyph sitting on its room's boundary", () => {
  const geojson = extractGeojsonModules(bundle);
  // The first fixture glyph transforms to [102.16, 2.42]; this room's ring
  // lies 2.58u below it — outside the polygon, within the tolerance.
  geojson.rooms.push({
    properties: { name: "Doorway" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [102.16, 5],
          [107, 5],
          [107, 8],
          [102.16, 8],
          [102.16, 5],
        ],
      ],
    },
  });

  const { entries, unresolved } = resolveShortcutEndpoints(geojson, [
    { node: 107, shortcut: "Cellar", room: "Doorway" },
  ]);
  assert.deepEqual(unresolved, []);
  assert.deepEqual(entries, [
    {
      name: "Doorway",
      node: 107,
      position: [102.16, 2.42],
      note: "Cellar City Shortcut glyph (teleport spot)",
    },
  ]);
});
