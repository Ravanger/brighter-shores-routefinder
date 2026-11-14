import test from "node:test";
import assert from "node:assert/strict";
import { defaultSettings } from "./useSettings.js";

test("the Express bounty board is off by default", () => {
  assert.equal(defaultSettings.expressBountyBoard, false);
});
