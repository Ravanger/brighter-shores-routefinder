import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildRouteGeometry,
  buildRouteSteps,
  formatStepCaption,
  formatStopNumbers,
} from "../algorithm/routeMapData.js";
import { nodePositions } from "../algorithm/nodePositions.js";
import {
  WIKI_IMAGE_BOUNDS,
  WIKI_MAX_NATIVE_ZOOM,
  WIKI_MAX_ZOOM,
  WIKI_MIN_NATIVE_ZOOM,
  WIKI_MIN_ZOOM,
  WIKI_TILE_SIZE,
  WIKI_TILE_URL,
  WIKI_TRANSFORMATION,
  bfTileToLatLng,
  clampBoundsToImage,
} from "../algorithm/wikiMap.js";

const STEP_MS = 1200;

// Numbered stop marker: a pill wide enough for the label ("9–11"), a
// circle for one or two digits. Inline styles: Leaflet renders the icon
// HTML outside React, so Tailwind classes would not apply reliably.
const placeIcon = (L, label, visited) =>
  L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${label.length > 2 ? 12 + label.length * 8 : 26}px;height:${label.length > 2 ? 24 : 26}px;border-radius:999px;border:2px solid #2563eb;background:${visited ? "#2563eb" : "#ffffff"};color:${visited ? "#ffffff" : "#2563eb"};font-weight:700;font-size:12px;line-height:1;">${label}</div>`,
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
 * the route as a polyline, numbered stop markers, and a step-through
 * animation (play/pause/previous/next/replay) with a caption in sync.
 * Leaflet is loaded dynamically so the server render (and the render test)
 * never touches the DOM: it only renders the container and controls.
 */
const RouteMap = ({
  actions,
  detectiveMilestone,
  battleOfFortuneholdCompleted,
  roundTrip,
  positions = nodePositions,
}) => {
  const geometry = useMemo(
    () =>
      buildRouteGeometry(
        actions,
        detectiveMilestone,
        battleOfFortuneholdCompleted,
        roundTrip,
        positions,
      ),
    [
      actions,
      detectiveMilestone,
      battleOfFortuneholdCompleted,
      roundTrip,
      positions,
    ],
  );
  const route = useMemo(
    () =>
      geometry ? buildRouteSteps(geometry, actions, roundTrip, positions) : null,
    [geometry, actions, roundTrip, positions],
  );

  const total =
    route?.steps.filter((step) => step.number !== null).length ?? 0;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
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
        'Tiles: <a href="https://brightershoreswiki.org/w/Map">Brighter Shores Wiki</a> · Positions: <a href="https://brighterfinder.com/">BrighterFinder</a>',
    }).addTo(map);
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

  // Draw the route, markers and travelling dot for the current step.
  useEffect(() => {
    const map = mapRef.current;
    const L = leaflet;
    const layers = layersRef.current;
    if (!map || !L || !layers || !route) {
      return;
    }
    layers.clearLayers();
    const { routePoints, places, steps } = route;
    const current = step === 0 ? null : steps[step - 1];
    const progressEnd = current ? current.pointIndex : 0;

    // Base route: faint lines, dashed for teleports.
    for (let i = 1; i < routePoints.length; i++) {
      const a = routePoints[i - 1];
      const b = routePoints[i];
      L.polyline(
        [a.latLng, b.latLng],
        b.dashed
          ? { color: "#a1a1aa", weight: 3, dashArray: "8 6", opacity: 0.7 }
          : { color: "#93c5fd", weight: 3, opacity: 0.7 },
      ).addTo(layers);
    }
    // Travelled part: brighter, up to the current step.
    for (let i = 1; i <= progressEnd; i++) {
      const a = routePoints[i - 1];
      const b = routePoints[i];
      L.polyline(
        [a.latLng, b.latLng],
        b.dashed
          ? { color: "#52525b", weight: 4, dashArray: "8 6" }
          : { color: "#2563eb", weight: 4 },
      ).addTo(layers);
    }

    if (geometry.start) {
      L.marker(bfTileToLatLng([geometry.start.x, geometry.start.y]), {
        icon: startIcon(L),
        interactive: false,
      }).addTo(layers);
    }
    for (const place of places) {
      const marker = L.marker(place.latLng, {
        icon: placeIcon(
          L,
          formatStopNumbers(place.numbers),
          place.numbers[0] <= step,
        ),
      });
      marker.on("click", () => {
        setPlaying(false);
        setStep(place.numbers[0]);
      });
      marker.addTo(layers);
    }

    const dotAt =
      current?.latLng ??
      (geometry.start
        ? bfTileToLatLng([geometry.start.x, geometry.start.y])
        : null);
    if (dotAt) {
      L.circleMarker(dotAt, {
        radius: 7,
        color: "#ffffff",
        weight: 2,
        fillColor: "#dc2626",
        fillOpacity: 1,
      }).addTo(layers);
    }
  }, [leaflet, route, step, geometry]);

  // Back to the start when the route changes.
  useEffect(() => {
    setStep(0);
  }, [route]);

  // Advance one step at a time while playing; stop at the end.
  useEffect(() => {
    if (!playing || !route) {
      return;
    }
    if (step >= route.steps.length) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(
      () => setStep((s) => Math.min(s + 1, route.steps.length)),
      STEP_MS,
    );
    return () => clearTimeout(id);
  }, [playing, step, route]);

  if (!geometry || !route) {
    return null;
  }

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (step >= route.steps.length) {
      setStep(0);
    }
    setPlaying(true);
  };

  return (
    <div className="my-7">
      <div
        ref={containerRef}
        className="h-[420px] w-full overflow-hidden rounded"
        role="application"
        aria-label="Route map"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setStep((s) => Math.max(0, s - 1));
          }}
          disabled={step === 0}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className="rounded border px-3 py-1 text-sm"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setStep((s) => Math.min(s + 1, route.steps.length));
          }}
          disabled={step >= route.steps.length}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          Next
        </button>
        <button
          type="button"
          onClick={() => {
            setStep(0);
            setPlaying(true);
          }}
          className="rounded border px-3 py-1 text-sm"
        >
          Replay
        </button>
        <p className="text-sm">{formatStepCaption(route.steps, step, total)}</p>
      </div>
      <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
        Legend: green dot is the start, a numbered circle is a stop, a dashed
        line is a teleport.
      </p>
    </div>
  );
};

export default RouteMap;
