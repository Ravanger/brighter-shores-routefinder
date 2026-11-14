import { useMemo } from "react";
import { buildRouteGeometry } from "../algorithm/routeMapData.js";
import { nodePositions } from "../algorithm/nodePositions.js";

/**
 * A static schematic of the planned route: the stops in route order, joined
 * by the path the GPS actually takes between them. Dashed segments are
 * teleport jumps to a portal stone. No map tiles, no pan/zoom.
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

  if (!geometry) {
    return null;
  }

  const { segments, stops, start, viewBox } = geometry;

  return (
    <div className="my-7">
      <svg
        viewBox={viewBox.join(" ")}
        className="w-full h-auto"
        role="img"
        aria-label="Schematic map of the planned route"
      >
        {segments.map((segment, index) =>
          segment.dashed ? (
            <line
              key={index}
              x1={segment.points[0][0]}
              y1={segment.points[0][1]}
              x2={segment.points[1][0]}
              y2={segment.points[1][1]}
              className="stroke-zinc-400 dark:stroke-zinc-500"
              strokeWidth="2"
              strokeDasharray="7 5"
            />
          ) : (
            <polyline
              key={index}
              points={segment.points.map(([x, y]) => `${x},${y}`).join(" ")}
              className="fill-none stroke-blue-600 dark:stroke-blue-400"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ),
        )}
        {start && (
          <g>
            <circle
              cx={start.x}
              cy={start.y}
              r="7"
              className="fill-green-600 dark:fill-green-500"
            />
            <text
              x={start.x + 10}
              y={start.y + 3}
              fontSize="9"
              className="fill-gray-900 dark:fill-zinc-100"
            >
              {start.label}
            </text>
          </g>
        )}
        {stops.map((stop) => (
          <g key={stop.number}>
            <circle
              cx={stop.x}
              cy={stop.y}
              r="6"
              className="fill-white stroke-blue-600 dark:fill-zinc-900 dark:stroke-blue-400"
              strokeWidth="2"
            />
            <text
              x={stop.x}
              y={stop.y}
              fontSize="8"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-blue-600 dark:fill-blue-400"
            >
              {stop.number}
            </text>
            <text
              x={stop.x + 9}
              y={stop.y + 3}
              fontSize="9"
              className="fill-gray-900 dark:fill-zinc-100"
            >
              {stop.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-3 text-sm text-gray-500 dark:text-zinc-400">
        Schematic of the stops in route order, not the walking path. Dashed
        lines are teleports.
      </p>
    </div>
  );
};

export default RouteMap;
