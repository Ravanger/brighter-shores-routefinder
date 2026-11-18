import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Legend from "./Legend.jsx";

test("renders collapsed by default, hiding the swatches", () => {
  const html = renderToStaticMarkup(React.createElement(Legend));

  assert.match(html, />Legend ▴</);
  assert.match(html, /aria-expanded="false"/);
  // Collapsed: no swatch SVGs in the markup.
  assert.doesNotMatch(html, /<svg /);
});
