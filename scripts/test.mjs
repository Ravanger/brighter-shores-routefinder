import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

// Runs the repo's tests with node:test (no test runner dependency).
// The component render tests import .jsx, which node cannot parse, so they
// are bundled to plain JS with esbuild (already present via vite) first.
// The bundles are CommonJS: react-dom/server requires Node builtins in a
// way the ESM bundle shim cannot handle.
// On Windows, node_modules/.bin/esbuild is an extensionless shell shim that
// execFileSync cannot start, so run the esbuild package's JS launcher at
// bin/esbuild through node. esbuild's postinstall replaces that file with
// the native binary in place on other platforms, where it must be executed
// directly instead.
const esbuild = "node_modules/esbuild/bin/esbuild";
const esbuildCommand =
  process.platform === "win32" ? [process.execPath, esbuild] : [esbuild];

if (!existsSync(esbuild)) {
  console.error("esbuild not found — run npm install first.");
  process.exit(1);
}

const jsxTests = [
  "src/components/Legend.test.mjs",
  "src/components/OverlayToggles.test.mjs",
  "src/components/RouteMap.test.mjs",
];

const tmp = mkdtempSync(join(tmpdir(), "routefinder-test-"));

try {
  execFileSync(
    esbuildCommand[0],
    [
      ...esbuildCommand.slice(1),
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
      "src/algorithm/edgePaths.test.mjs",
      "src/algorithm/nodePositions.test.mjs",
      "src/algorithm/pathfinder.test.mjs",
      "src/algorithm/questRooms.test.mjs",
      "src/algorithm/routeMapData.test.mjs",
      "src/algorithm/wikiMap.test.mjs",
      "src/hooks/useSettings.test.mjs",
      "scripts/generateNodePositions.test.mjs",
      "scripts/generateEdgePaths.test.mjs",
      // esbuild names the bundles <entry>.js for --format=cjs.
      ...jsxTests.map((file) => join(tmp, `${basename(file, ".mjs")}.js`)),
    ],
    { stdio: "inherit" },
  );

  process.exit(run.status ?? 1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
