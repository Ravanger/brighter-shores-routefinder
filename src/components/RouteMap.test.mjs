import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RouteMap from "./RouteMap.jsx";

// The Leaflet map itself is created in an effect, so the server render only
// covers the container and legend. Tile and marker rendering is client-side.
const sampleActions = [
  { type: "buy", item: "CARROTS", location: "Toy Stall", distance: 10 },
  { type: "teleport", location: "Crenopolis Market", distance: 18 },
  { type: "sell", item: "CARROTS", location: "Cheese Shop", distance: 30 },
  { type: "Return", location: "Guild Bounty Board", distance: 60 },
];

const render = (props) =>
  renderToStaticMarkup(React.createElement(RouteMap, props));

test("renders the map container and legend, with no playback controls", () => {
  const html = render({
    actions: sampleActions,
    detectiveMilestone: 0,
    battleOfFortuneholdCompleted: false,
    roundTrip: true,
  });

  assert.match(html, /role="application"/); // map container
  assert.match(html, /aria-label="Route map"/);
  assert.doesNotMatch(html, />Play</); // animation removed: no controls
  assert.doesNotMatch(html, />Pause</);
  assert.doesNotMatch(html, />Previous</);
  assert.doesNotMatch(html, />Next</);
  assert.doesNotMatch(html, />Replay</);
  assert.doesNotMatch(html, /Start at Guild Bounty Board/); // no step caption
  // The legend is pinned to the map's corner, collapsed by default: just a
  // button, no swatches until expanded (see Legend.test.mjs).
  assert.match(html, />Legend ▴</);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /<svg /);

  // The overlay toggles live above the map (RoutePlanner), not in it.
  assert.doesNotMatch(html, />Overlays</);
});

test("renders nothing when no stop has a position", () => {
  const html = render({
    actions: sampleActions,
    detectiveMilestone: 0,
    battleOfFortuneholdCompleted: false,
    roundTrip: true,
    positions: {},
  });

  assert.equal(html, "");
});

test("renders the map container with the Express board selected", () => {
  const html = render({
    actions: sampleActions,
    detectiveMilestone: 0,
    battleOfFortuneholdCompleted: false,
    roundTrip: true,
    expressBountyBoard: true,
  });

  assert.match(html, /role="application"/); // map container
  assert.match(html, /aria-label="Route map"/);
});
