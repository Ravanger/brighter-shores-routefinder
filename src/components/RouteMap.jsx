import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildRouteGeometry,
  buildRouteSteps,
  formatStopNumbers,
} from "../algorithm/routeMapData.js";
import { nodePositions } from "../algorithm/nodePositions.js";
import {
  bountyBoard,
  expressBountyBoard as expressBoard,
} from "../algorithm/nodes.js";
import {
  WIKI_IMAGE_BOUNDS,
  WIKI_MAX_NATIVE_ZOOM,
  WIKI_MAX_ZOOM,
  WIKI_MIN_NATIVE_ZOOM,
  WIKI_MIN_ZOOM,
  WIKI_TILE_SIZE,
  WIKI_TILE_URL,
  WIKI_TRANSFORMATION,
  wikiToLatLng,
  clampBoundsToImage,
  routeLabelZoomClass,
} from "../algorithm/wikiMap.js";

// Numbered stop marker: a pill wide enough for the label ("9–11"), a
// circle for one or two digits. Inline styles: Leaflet renders the icon
// HTML outside React, so Tailwind classes would not apply reliably.
const placeIcon = (L, label) =>
  L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${label.length > 2 ? 12 + label.length * 8 : 26}px;height:${label.length > 2 ? 24 : 26}px;border-radius:999px;border:2px solid #2563eb;background:#ffffff;color:#2563eb;font-weight:700;font-size:12px;line-height:1;">${label}</div>`,
    iconSize:
      label.length > 2 ? [12 + label.length * 8, 24] : [26, 26],
    iconAnchor:
      label.length > 2
        ? [(12 + label.length * 8) / 2, 12]
        : [13, 13],
  });

const startIcon = (L) =>
  L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:999px;background:#16a34a;border:2px solid #ffffff;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

/**
 * The planned route on the Brighter Shores wiki map: tiles from the wiki,
 * the route as a polyline, numbered stop markers. The full route is shown
 * statically — no playback, no animation. Leaflet is loaded dynamically
 * so the server render (and the render test) never touches the DOM: it
 * only renders the container and legend.
 */
const RouteMap = ({
  actions,
  detectiveMilestone,
  battleOfFortuneholdCompleted,
  roundTrip,
  expressBountyBoard = false,
  enabledCrimeDens = [],
  positions = nodePositions,
}) => {
  const board = expressBountyBoard ? expressBoard : bountyBoard;
  const geometry = useMemo(
    () =>
      buildRouteGeometry(
        actions,
        detectiveMilestone,
        battleOfFortuneholdCompleted,
        roundTrip,
        positions,
        board,
        enabledCrimeDens,
      ),
    [
      actions,
      detectiveMilestone,
      battleOfFortuneholdCompleted,
      roundTrip,
      positions,
      board,
      enabledCrimeDens,
    ],
  );
  const route = useMemo(
    () =>
      geometry ? buildRouteSteps(geometry, actions, roundTrip, positions) : null,
    [geometry, actions, roundTrip, positions],
  );

  const [leaflet, setLeaflet] = useState(null);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(null);

  // Load Leaflet on the client only.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((module) => {
      if (!cancelled) {
        setLeaflet(module.default ?? module);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Create the map once Leaflet is loaded and the container exists. If the
  // component rendered nothing for a while (no route), the container was
  // removed from the DOM; a map attached to that detached node is discarded
  // and recreated on the fresh container.
  useEffect(() => {
    if (
      mapRef.current &&
      mapRef.current.getContainer() !== containerRef.current
    ) {
      mapRef.current.remove();
      mapRef.current = null;
      layersRef.current = null;
    }
    if (!leaflet || !containerRef.current || mapRef.current) {
      return;
    }
    const L = leaflet;
    const crs = L.extend({}, L.CRS.Simple, {
      transformation: new L.Transformation(...WIKI_TRANSFORMATION),
    });
    const map = L.map(containerRef.current, {
      crs,
      minZoom: WIKI_MIN_ZOOM,
      maxZoom: WIKI_MAX_ZOOM,
      // The real image bounds, not the wiki's padded bounds: past the
      // image edge there are no tiles, only blank padding and void.
      maxBounds: WIKI_IMAGE_BOUNDS,
      maxBoundsViscosity: 1.0,
    });
    L.tileLayer(WIKI_TILE_URL, {
      minNativeZoom: WIKI_MIN_NATIVE_ZOOM,
      maxNativeZoom: WIKI_MAX_NATIVE_ZOOM,
      noWrap: true,
      tileSize: WIKI_TILE_SIZE,
      bounds: WIKI_IMAGE_BOUNDS,
      attribution:
        'Tiles and positions: <a href="https://brightershoreswiki.org/w/Map">Brighter Shores Wiki</a>',
    }).addTo(map);
    // Stop-name labels: hidden at low zoom, shown when zoomed in (see
    // routeLabelZoomClass and the .route-stop-label rules in index.css).
    const updateLabels = () => {
      const container = map.getContainer();
      container.classList.remove(
        "route-labels-6",
        "route-labels-7",
        "route-labels-8",
      );
      const labelClass = routeLabelZoomClass(map.getZoom());
      if (labelClass) {
        container.classList.add(labelClass);
      }
    };
    map.on("zoomend", updateLabels);
    updateLabels();
    mapRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);
  }, [leaflet, route]);

  // Remove the map on unmount only (not when the route changes).
  useEffect(
    () => () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layersRef.current = null;
      }
    },
    [],
  );

  // Fit the view to the route when it (or the map) appears, then pull the
  // view back inside the real image bounds: fitBounds expands to the
  // container's aspect ratio, which can push the view past the image edge
  // (the blank rectangles / black strip at the east edge).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route) {
      return;
    }
    map.fitBounds(route.bounds, { padding: [24, 24], animate: false });
    const view = map.getBounds();
    const clamped = clampBoundsToImage([
      [view.getSouth(), view.getWest()],
      [view.getNorth(), view.getEast()],
    ]);
    const moved =
      Math.abs(clamped[0][0] - view.getSouth()) > 1e-9 ||
      Math.abs(clamped[0][1] - view.getWest()) > 1e-9 ||
      Math.abs(clamped[1][0] - view.getNorth()) > 1e-9 ||
      Math.abs(clamped[1][1] - view.getEast()) > 1e-9;
    if (moved) {
      map.fitBounds(clamped, { animate: false });
    }
  }, [leaflet, route]);

  // Draw the full route and markers, statically.
  useEffect(() => {
    const map = mapRef.current;
    const L = leaflet;
    const layers = layersRef.current;
    if (!map || !L || !layers || !route) {
      return;
    }
    layers.clearLayers();
    const { routePoints, places } = route;

    // Full route: solid for walking, dashed grey for teleports, dashed
    // purple for City Shortcut crossings. Jump legs carry a hover tooltip
    // naming the shortcut or portal stone (pill styling and fade-in live
    // in index.css).
    for (let i = 1; i < routePoints.length; i++) {
      const a = routePoints[i - 1];
      const b = routePoints[i];
      const style =
        b.kind === "shortcut"
          ? { color: "#7c3aed", weight: 4, dashArray: "8 6" }
          : b.kind === "teleport"
            ? { color: "#52525b", weight: 4, dashArray: "8 6" }
            : { color: "#2563eb", weight: 4 };
      const line = L.polyline([a.latLng, b.latLng], style);
      if (b.name) {
        line.bindTooltip(
          `<span class="route-jump-type">${
            b.kind === "shortcut" ? "City Shortcut" : "Teleport"
          }</span>${b.name}`,
          {
            sticky: true,
            className: `route-jump-tooltip route-jump-tooltip--${b.kind}`,
          },
        );
      }
      line.addTo(layers);
    }

    // Jump stops: a plain dot at each portal stone and shortcut teleport
    // spot the route uses (grey for teleports, purple for shortcuts).
    // Drawn before the markers so a numbered stop on the same spot covers
    // it.
    for (const jump of geometry.jumps) {
      L.circleMarker(wikiToLatLng([jump.x, jump.y]), {
        radius: 5,
        color: "#ffffff",
        weight: 2,
        fillColor: jump.kind === "shortcut" ? "#7c3aed" : "#52525b",
        fillOpacity: 1,
        interactive: false,
      }).addTo(layers);
    }

    // Crime den rooms the route walks through: a red dot at each room's own
    // position (the walk line bends through it), with a hover pill naming
    // the den and room. Drawn before the markers so a numbered stop on the
    // same spot covers it.
    for (const den of geometry.dens) {
      const marker = L.circleMarker(wikiToLatLng([den.x, den.y]), {
        radius: 5,
        color: "#ffffff",
        weight: 2,
        fillColor: "#dc2626",
        fillOpacity: 1,
      });
      marker.bindTooltip(
        `<span class="route-jump-type">Crime Den</span>${den.name} — ${den.room}`,
        { className: "route-jump-tooltip route-jump-tooltip--den" },
      );
      marker.addTo(layers);
    }

    if (geometry.start) {
      const start = L.marker(wikiToLatLng([geometry.start.x, geometry.start.y]), {
        icon: startIcon(L),
        interactive: false,
      });
      start.bindTooltip(geometry.start.label, {
        permanent: true,
        direction: "auto",
        className: "route-stop-label",
        offset: [12, 0],
      });
      start.addTo(layers);
    }
    for (const place of places) {
      const marker = L.marker(place.latLng, {
        icon: placeIcon(L, formatStopNumbers(place.numbers)),
      });
      marker.bindTooltip(place.label, {
        permanent: true,
        direction: "auto",
        className: "route-stop-label",
        offset: [12, 0],
      });
      marker.addTo(layers);
    }
  }, [leaflet, route, geometry]);

  if (!geometry || !route) {
    return null;
  }

  return (
    <div className="my-7">
      <div
        ref={containerRef}
        className="h-[420px] w-full overflow-hidden rounded"
        role="application"
        aria-label="Route map"
      />
      <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
        Legend: green dot is the start, a numbered circle is a stop, a dashed
        line is a teleport, a dotted purple line is an unlocked City Shortcut.
      </p>
    </div>
  );
};

export default RouteMap;
