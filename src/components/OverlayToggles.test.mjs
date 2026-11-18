import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OverlayToggles from "./OverlayToggles.jsx";

const render = (overlays) =>
  renderToStaticMarkup(
    React.createElement(OverlayToggles, {
      overlays: overlays ?? { shortcuts: false, dens: false },
      onChange: () => {},
    }),
  );

test("renders collapsed by default, hiding the toggles", () => {
  const html = render();

  assert.match(html, />Overlays ▾</);
  assert.match(html, /aria-expanded="false"/);
  // Collapsed: neither checkbox is in the markup.
  assert.doesNotMatch(html, /type="checkbox"/);
});
