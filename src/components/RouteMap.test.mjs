import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RouteMap from "./RouteMap.jsx";

// The Leaflet map itself is created in an effect, so the server render only
// covers the container, controls, caption and legend. Tile and marker
// rendering is client-side.
const sampleActions = [
  { type: "buy", item: "CARROTS", location: "Toy Stall", distance: 10 },
  { type: "teleport", location: "Crenopolis Market", distance: 18 },
  { type: "sell", item: "CARROTS", location: "Cheese Shop", distance: 30 },
  { type: "Return", location: "Guild Bounty Board", distance: 60 },
];

const render = (props) =>
  renderToStaticMarkup(React.createElement(RouteMap, props));

test("renders the map container with step controls, caption and legend", () => {
  const html = render({
    actions: sampleActions,
    detectiveMilestone: 0,
    battleOfFortuneholdCompleted: false,
    roundTrip: true,
  });

  assert.match(html, /role="application"/); // map container
  assert.match(html, /aria-label="Route map"/);
  assert.match(html, />Play</); // playback controls
  assert.match(html, />Previous</);
  assert.match(html, />Next</);
  assert.match(html, />Replay</);
  assert.match(html, /Start at Guild Bounty Board/); // step 0 caption
  assert.match(html, /green dot is the start/); // legend
  assert.match(html, /a numbered circle is a stop/);
  assert.match(html, /a dashed line is a teleport/);
  assert.doesNotMatch(html, /<svg/); // no schematic anymore
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
