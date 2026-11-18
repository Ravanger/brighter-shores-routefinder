import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

// Runs the repo's tests with node:test (no test runner dependency).
// The component render tests import .jsx, which node cannot parse, so they
// are bundled to plain JS with esbuild (already present via vite) first.
// The bundles are CommonJS: react-dom/server requires Node builtins in a
// way the ESM bundle shim cannot handle.
const esbuild = "node_modules/.bin/esbuild";

if (!existsSync(esbuild)) {
  console.error("esbuild not found — run npm install first.");
  process.exit(1);
}

const jsxTests = [
  "src/components/Legend.test.mjs",
  "src/components/RouteMap.test.mjs",
];

const tmp = mkdtempSync(join(tmpdir(), "routefinder-test-"));

try {
  execFileSync(
    esbuild,
    [
      ...jsxTests,
      "--bundle",
      "--platform=node",
      "--format=cjs",
      "--jsx=automatic",
      // RouteMap dynamically imports leaflet (client-only); keep it external
      // so the bundle step does not try to split it into chunks.
      "--external:leaflet",
      `--outdir=${tmp}`,
    ],
    { stdio: "inherit" },
  );

  const run = spawnSync(
    "node",
    [
      "--test",
      "src/algorithm/cityShortcuts.test.mjs",
      "src/algorithm/crimeDens.test.mjs",
      "src/algorithm/nodePositions.test.mjs",
      "src/algorithm/pathfinder.test.mjs",
      "src/algorithm/questRooms.test.mjs",
      "src/algorithm/routeMapData.test.mjs",
      "src/algorithm/wikiMap.test.mjs",
      "src/hooks/useSettings.test.mjs",
      "scripts/generateNodePositions.test.mjs",
      // esbuild names the bundles <entry>.js for --format=cjs.
      ...jsxTests.map((file) => join(tmp, `${basename(file, ".mjs")}.js`)),
    ],
    { stdio: "inherit" },
  );

  process.exit(run.status ?? 1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
