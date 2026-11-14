import test from "node:test";
import assert from "node:assert/strict";
import {
  extractGeojsonModules,
  resolvePositions,
} from "./generateNodePositions.mjs";

// A synthetic slice of the gadget bundle: the data modules are
// JSON.parse('...') literals, plus an unrelated one that must be ignored.
const bundle = `
  582:e=>{"use strict";e.exports=JSON.parse('{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Greengrocers","category":"Room","episode":"Episode 1"},"geometry":{"type":"Polygon","coordinates":[[[340,53],[342,53],[342,55],[340,55],[340,53]]]}}]}')},
  207:e=>{"use strict";e.exports=JSON.parse('{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Bubbles MacLeish","category":"Entity","size":[1,1],"classes":["icon-merchant"]},"geometry":{"type":"Point","coordinates":[360,8]}},{"type":"Feature","properties":{"name":"Hermar","category":"Entity","size":[1,1],"classes":["icon-merchant"]},"geometry":{"type":"Point","coordinates":[319,58]}},{"type":"Feature","properties":{"name":"Hermar","category":"Entity","size":[1,1],"classes":["icon-talk","theme-merchant"]},"geometry":{"type":"Point","coordinates":[474,16]}}]}')},
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
