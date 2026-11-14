import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RouteMap from "./RouteMap.jsx";

const sampleActions = [
  { type: "buy", item: "CARROTS", location: "Toy Stall", distance: 10 },
  { type: "teleport", location: "Crenopolis Market", distance: 18 },
  { type: "sell", item: "CARROTS", location: "Cheese Shop", distance: 30 },
  { type: "Return", location: "Guild Bounty Board", distance: 60 },
];

const render = (props) =>
  renderToStaticMarkup(React.createElement(RouteMap, props));

test("renders the route as an SVG with numbered stops and a dashed teleport", () => {
  const html = render({
    actions: sampleActions,
    detectiveMilestone: 0,
    battleOfFortuneholdCompleted: false,
    roundTrip: true,
  });

  assert.match(html, /<svg[^>]*viewBox="299 90 245\.5 99"/);
  assert.match(html, /513,114 491,165/); // board -> Toy Stall polyline
  assert.match(html, /491,165/); // Toy Stall position
  assert.match(html, /323,121/); // Cheese Shop position
  assert.match(html, />1</); // stop number 1
  assert.match(html, />2</); // stop number 2
  assert.match(html, /stroke-dasharray/); // teleport segment
  assert.match(html, /Toy Stall/); // stop label
  assert.match(html, /Cheese Shop/); // stop label
  assert.match(html, /Guild Bounty Board/); // start label
  assert.match(html, /schematic/i); // caption
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
