import { useState } from "react";

// Graphical legend swatches matching the map's own colors and styles.
const lineSwatch = (color, dashed) => (
  <svg width="24" height="8" aria-hidden="true">
    <line
      x1="1"
      y1="4"
      x2="23"
      y2="4"
      stroke={color}
      strokeWidth="3"
      strokeDasharray={dashed ? "6 4" : undefined}
    />
  </svg>
);

const dotSwatch = (fill) => (
  <svg width="12" height="12" aria-hidden="true">
    <circle cx="6" cy="6" r="4.5" fill={fill} stroke="#ffffff" strokeWidth="1.5" />
  </svg>
);

// Collapsible legend for the route map, overlaid on its bottom-right corner.
// Collapsed by default; when expanded the swatch list grows upward over the
// map (the wrapper is pinned to the corner, so no page content shifts).
const Legend = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      {open && (
        <ul className="flex flex-col gap-1 rounded-md border border-gray-200 bg-white/95 px-2.5 py-2 text-xs shadow dark:border-zinc-700 dark:bg-zinc-800/95 text-gray-500 dark:text-zinc-400">
          <li className="flex items-center gap-1.5">{dotSwatch("#16a34a")}start</li>
          <li className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#2563eb] bg-white text-[9px] leading-none font-bold text-[#2563eb]">
              1
            </span>
            stop
          </li>
          <li className="flex items-center gap-1.5">
            {lineSwatch("#2563eb", false)}walking
          </li>
          <li className="flex items-center gap-1.5">{lineSwatch("#52525b", true)}teleport</li>
          <li className="flex items-center gap-1.5">
            {lineSwatch("#7c3aed", true)}City Shortcut crossing
          </li>
          <li className="flex items-center gap-1.5">{dotSwatch("#52525b")}portal stone</li>
          <li className="flex items-center gap-1.5">
            {dotSwatch("#7c3aed")}shortcut spot
          </li>
          <li className="flex items-center gap-1.5">{dotSwatch("#dc2626")}crime den room</li>
        </ul>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="whitespace-nowrap rounded-md border border-gray-200 bg-white/90 px-2.5 py-1 text-xs font-semibold cursor-pointer select-none text-gray-500 hover:text-gray-800 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Legend {open ? "▾" : "▴"}
      </button>
    </div>
  );
};

export default Legend;
