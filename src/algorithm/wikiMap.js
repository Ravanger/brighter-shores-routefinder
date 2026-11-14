// Map constants and coordinate conversions for the Brighter Shores wiki map.
// Source: https://brightershoreswiki.org/w/MediaWiki:Gadget-leaflet-wiki.js?action=raw
// (fetched 2026-11-14). The wiki map is Leaflet with CRS.Simple; the values
// below are transcribed from that file, including the Hopeport Portal Stone
// anchor used to derive the CRS transformation and bounds.

// Tile layer: https://brightershoreswiki.org/images/
// Brighter_Shores_World_Map_Tile_{z}_{y}_{x}.png (note y before x).
export const WIKI_TILE_URL =
  "https://brightershoreswiki.org/images/Brighter_Shores_World_Map_Tile_{z}_{y}_{x}.png";
export const WIKI_TILE_SIZE = 256; // image_tile_dimensions
export const WIKI_TILE_WIDTH = 48; // tile_width: game pixels per tile
export const WIKI_IMAGE_WIDTH = 33600;
export const WIKI_IMAGE_HEIGHT = 19056;
export const WIKI_MIN_ZOOM = 3;
export const WIKI_MAX_ZOOM = 8;
export const WIKI_MIN_NATIVE_ZOOM = 0;
export const WIKI_MAX_NATIVE_ZOOM = 8;

// Hopeport Portal Stone anchor, from the same file.
const PORTAL_IMAGE = [9576, 3431];
const PORTAL_COORD = [-8, 1]; // in-game [x, y]

const nextPow2 = (value) => 2 ** Math.ceil(Math.log2(value));

// Same derivation as the wiki gadget: the image is padded to the next
// power of two, then divided into 48px tiles.
const paddedTilesX = nextPow2(WIKI_IMAGE_WIDTH) / WIKI_TILE_WIDTH;
const paddedTilesY = nextPow2(WIKI_IMAGE_HEIGHT) / WIKI_TILE_WIDTH;
const portalTileX = Math.floor(PORTAL_IMAGE[0] / WIKI_TILE_WIDTH);
const portalTileY = Math.floor(PORTAL_IMAGE[1] / WIKI_TILE_WIDTH);
const m = PORTAL_COORD[0] - portalTileX; // -207
const l = PORTAL_COORD[1] - portalTileY; // -70
const u = WIKI_TILE_WIDTH / WIKI_TILE_SIZE; // 0.1875

// L.Transformation(u, -m*u, u, -l*u): latLng -> pixel at a given zoom.
export const WIKI_TRANSFORMATION = [u, -m * u, u, -l * u];
// L.latLngBounds([l, m], [l + paddedTilesY, m + paddedTilesX]).
export const WIKI_BOUNDS = [
  [l, m],
  [l + paddedTilesY, m + paddedTilesX],
];

// BrighterFinder Tile coords -> wiki in-game coords.
// Verified 2026-11-14 against exact integer NPC positions present in both
// datasets (the wiki gadget's GeoJSON vs BrighterFinder's lookup_table.json):
// 20 of 21 uniquely-matchable markers agree exactly on (77, 72). The one
// exception is Ignatius (Cabbage Stall), where the two sources genuinely
// disagree on where the NPC is — not a transform error. The earlier
// hover-based estimate (78, 73) was off by (1, 1). Note the offset is not
// global: other regions (Hopeport, Mine of Mantuban) stitch differently,
// but every routefinder node sits inside the verified Crenopolis footprint.
export const BF_TO_WIKI_OFFSET = [77, 72];

/** BrighterFinder Tile [x, y] -> wiki in-game [x, y]. */
export const bfTileToWiki = ([x, y]) => [
  x - BF_TO_WIKI_OFFSET[0],
  y - BF_TO_WIKI_OFFSET[1],
];

/** Wiki in-game [x, y] -> Leaflet latLng [lat, lng]. */
export const wikiToLatLng = ([x, y]) => [y, x];

/** BrighterFinder Tile [x, y] -> Leaflet latLng [lat, lng]. */
export const bfTileToLatLng = (tile) => wikiToLatLng(bfTileToWiki(tile));

/**
 * Replicates L.CRS.Simple + the wiki transformation: latLng [lat, lng] ->
 * pixel [x, y] at the given zoom. Used to verify the constants, not at
 * runtime (Leaflet does this itself once given the transformation).
 */
export const wikiLatLngToPoint = ([lat, lng], zoom) => {
  const scale = 2 ** zoom;
  const [a, b, c, d] = WIKI_TRANSFORMATION;
  return [scale * (a * lng + b), scale * (c * lat + d)];
};
