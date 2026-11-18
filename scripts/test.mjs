import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Runs the repo's tests with node:test (no test runner dependency).
// The RouteMap render test imports .jsx, which node cannot parse, so it is
// bundled to plain JS with esbuild (already present via vite) first. The
// bundle is CommonJS: react-dom/server requires Node builtins in a way the
// ESM bundle shim cannot handle.
const esbuild = "node_modules/.bin/esbuild";

if (!existsSync(esbuild)) {
  console.error("esbuild not found — run npm install first.");
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "routefinder-test-"));
const bundledTest = join(tmp, "RouteMap.test.cjs");

try {
  execFileSync(
    esbuild,
    [
      "src/components/RouteMap.test.mjs",
      "--bundle",
      "--platform=node",
      "--format=cjs",
      "--jsx=automatic",
      // RouteMap dynamically imports leaflet (client-only); keep it external
      // so the bundle step does not try to split it into chunks.
      "--external:leaflet",
      `--outfile=${bundledTest}`,
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
      "src/algorithm/routeMapData.test.mjs",
      "src/algorithm/wikiMap.test.mjs",
      "src/hooks/useSettings.test.mjs",
      "scripts/generateNodePositions.test.mjs",
      bundledTest,
    ],
    { stdio: "inherit" },
  );

  process.exit(run.status ?? 1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
