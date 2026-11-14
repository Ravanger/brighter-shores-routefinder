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

// The bounds of the REAL image, unpadded: 33600/48 = 700 tiles wide,
// 19056/48 = 397 tall. The padded bounds above are what the wiki gadget
// passes to Leaflet, but the tiles only cover this smaller area — past its
// east edge (wiki x 493) there are blank padding tiles and then nothing at
// all, which is the blank rectangles / black strip the live map showed.
// Constrain the view and the tile layer to these bounds instead.
export const WIKI_IMAGE_BOUNDS = [
  [l, m],
  [l + WIKI_IMAGE_HEIGHT / WIKI_TILE_WIDTH, m + WIKI_IMAGE_WIDTH / WIKI_TILE_WIDTH],
];

/**
 * Clamp a [[south, west], [north, east]] latLng bounds so it stays inside
 * the real image bounds. A view smaller than the image is shifted (same
 * size, same zoom); a view larger than the image in a dimension is shrunk
 * to the image in that dimension.
 */
export const clampBoundsToImage = (view, image = WIKI_IMAGE_BOUNDS) => {
  const clampSpan = (lo, hi, min, max) => {
    const size = hi - lo;
    if (size >= max - min) return [min, max];
    if (lo < min) return [min, min + size];
    if (hi > max) return [max - size, max];
    return [lo, hi];
  };
  const [latLo, latHi] = clampSpan(view[0][0], view[1][0], image[0][0], image[1][0]);
  const [lngLo, lngHi] = clampSpan(view[0][1], view[1][1], image[0][1], image[1][1]);
  return [
    [latLo, lngLo],
    [latHi, lngHi],
  ];
};

// Stop-name labels on the map: hidden at the default fitted view (zoom
// ~4, where they would overlap) and shown once the user zooms in, with
// the font stepping up with the zoom. The class is toggled on the map
// container; the CSS in src/index.css does the showing and sizing.
export const ROUTE_LABEL_MIN_ZOOM = 6;

/** Zoom -> container class for the stop-name labels ("" = hidden). */
export const routeLabelZoomClass = (zoom) => {
  const z = Math.floor(zoom);
  if (z < ROUTE_LABEL_MIN_ZOOM) {
    return "";
  }
  return `route-labels-${Math.min(z, WIKI_MAX_ZOOM)}`;
};

/** Wiki in-game [x, y] -> Leaflet latLng [lat, lng]. */
export const wikiToLatLng = ([x, y]) => [y, x];

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
