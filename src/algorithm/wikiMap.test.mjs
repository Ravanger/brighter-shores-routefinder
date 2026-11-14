import test from "node:test";
import assert from "node:assert/strict";
import {
  BF_TO_WIKI_OFFSET,
  WIKI_BOUNDS,
  WIKI_IMAGE_BOUNDS,
  WIKI_MAX_NATIVE_ZOOM,
  WIKI_MAX_ZOOM,
  WIKI_MIN_NATIVE_ZOOM,
  WIKI_MIN_ZOOM,
  WIKI_TILE_SIZE,
  WIKI_TILE_URL,
  WIKI_TRANSFORMATION,
  bfTileToLatLng,
  bfTileToWiki,
  clampBoundsToImage,
  routeLabelZoomClass,
  wikiLatLngToPoint,
  wikiToLatLng,
} from "./wikiMap.js";

// BrighterFinder Tile coords -> wiki in-game coords, pinned against exact
// integer NPC positions present in both datasets (wiki gadget GeoJSON vs
// BrighterFinder lookup_table.json). All six agree exactly on (77, 72);
// the earlier hover-based estimate (78, 73) was off by (1, 1).
test("converts BrighterFinder tiles to wiki coords with the verified offset", () => {
  assert.deepEqual(BF_TO_WIKI_OFFSET, [77, 72]);
  assert.deepEqual(bfTileToWiki([323, 121]), [246, 49]); // Ralph Cyclops
  assert.deepEqual(bfTileToWiki([491, 165]), [414, 93]); // Tonya the Tinkerer
  assert.deepEqual(bfTileToWiki([529, 122]), [452, 50]); // Bert
  assert.deepEqual(bfTileToWiki([336, 125]), [259, 53]); // Victor T Cyclops
  assert.deepEqual(bfTileToWiki([528, 110]), [451, 38]); // Henderson
  assert.deepEqual(bfTileToWiki([437, 80]), [360, 8]); // Bubbles MacLeish
});

test("converts wiki coords to Leaflet latLng as [y, x]", () => {
  assert.deepEqual(wikiToLatLng([246, 49]), [49, 246]);
  assert.deepEqual(wikiToLatLng([-8, 1]), [1, -8]);
  assert.deepEqual(bfTileToLatLng([323, 121]), [49, 246]);
});

test("uses the wiki tile URL template (y before x)", () => {
  assert.equal(
    WIKI_TILE_URL,
    "https://brightershoreswiki.org/images/Brighter_Shores_World_Map_Tile_{z}_{y}_{x}.png",
  );
  assert.equal(WIKI_TILE_SIZE, 256);
  assert.equal(WIKI_MIN_ZOOM, 3);
  assert.equal(WIKI_MAX_ZOOM, 8);
  assert.equal(WIKI_MIN_NATIVE_ZOOM, 0);
  assert.equal(WIKI_MAX_NATIVE_ZOOM, 8);
});

// Transformation and bounds, transcribed from the wiki gadget
// (MediaWiki:Gadget-leaflet-wiki.js): u = 48/256, m = -8 - floor(9576/48),
// l = 1 - floor(3431/48); bounds from the padded power-of-two image size.
test("replicates the wiki CRS transformation and bounds", () => {
  assert.deepEqual(WIKI_TRANSFORMATION, [0.1875, 38.8125, 0.1875, 13.125]);
  assert.deepEqual(WIKI_BOUNDS, [
    [-70, -207],
    [612.6666666666666, 1158.3333333333333],
  ]);
});

test("projects latLng to pixels like the wiki map", () => {
  // Hopeport Portal Stone, in-game (-8, 1): top-left of its tile at zoom 8.
  assert.deepEqual(wikiLatLngToPoint([1, -8], 8), [9552, 3408]);
  // Crenopolis Market, in-game (443.5, 61.5): tile (15, 3) at zoom 5.
  assert.deepEqual(wikiLatLngToPoint([61.5, 443.5], 5), [3903, 789]);
});

// The real image is 33600x19056px = 700x397 tiles, so the tiled area is
// lng -207..493, lat -70..327 — much smaller than the padded bounds above.
// The map must never show the void past the real image edge.
test("derives the real image bounds from the unpadded image size", () => {
  assert.deepEqual(WIKI_IMAGE_BOUNDS, [
    [-70, -207],
    [327, 493],
  ]);
});

test("clampBoundsToImage leaves a view inside the image untouched", () => {
  const view = [
    [0, 250],
    [90, 450],
  ];
  assert.deepEqual(clampBoundsToImage(view), view);
});

test("clampBoundsToImage shifts a view overflowing the east edge back inside", () => {
  // The live 12-stop route's fitted view: east edge past the real image
  // (wiki x 493) because the wide container shows more than the route bbox.
  const view = [
    [-4.5, 246],
    [93, 502],
  ];
  assert.deepEqual(clampBoundsToImage(view), [
    [-4.5, 237],
    [93, 493],
  ]);
});

test("clampBoundsToImage shifts a view overflowing the west and south edges", () => {
  assert.deepEqual(
    clampBoundsToImage([
      [-80, -220],
      [10, -100],
    ]),
    [
      [-70, -207],
      [20, -87],
    ],
  );
});

test("clampBoundsToImage centres a view larger than the image", () => {
  assert.deepEqual(
    clampBoundsToImage([
      [-100, -300],
      [400, 600],
    ]),
    WIKI_IMAGE_BOUNDS,
  );
});

// Stop-name labels stay hidden at the default fitted view (zoom ~4) so it
// stays as clean as now, and appear with a bigger font as the user zooms in.
test("route labels stay hidden below zoom 6 and step up in size above it", () => {
  assert.equal(routeLabelZoomClass(3), "");
  assert.equal(routeLabelZoomClass(4), "");
  assert.equal(routeLabelZoomClass(5), "");
  assert.equal(routeLabelZoomClass(5.9), "");
  assert.equal(routeLabelZoomClass(6), "route-labels-6");
  assert.equal(routeLabelZoomClass(6.4), "route-labels-6");
  assert.equal(routeLabelZoomClass(7), "route-labels-7");
  assert.equal(routeLabelZoomClass(8), "route-labels-8");
  assert.equal(routeLabelZoomClass(9), "route-labels-8");
});
