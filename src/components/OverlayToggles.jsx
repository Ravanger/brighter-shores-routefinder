import { useState } from "react";

// Small collapsible control above the route map: toggles extra map layers —
// every City Shortcut teleport spot and every crime den room, whether or
// not the current route uses them. Collapsed by default; session-only. When
// expanded the checkboxes drop down over the map (absolute) so the page
// content does not shift.
const OverlayToggles = ({ overlays, onChange }) => {
  const [open, setOpen] = useState(false);

  const checkbox =
    "h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600";

  return (
    <div className="relative flex w-full justify-end">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="whitespace-nowrap rounded-md border border-gray-200 bg-white/90 px-2.5 py-1 text-xs font-semibold cursor-pointer select-none text-gray-500 hover:text-gray-800 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Overlays {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-[1001] mt-1 flex flex-col gap-1 rounded-md border border-gray-200 bg-white/95 px-2.5 py-1.5 text-xs shadow dark:border-zinc-700 dark:bg-zinc-800/95">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-gray-900 dark:text-zinc-100">
            <input
              type="checkbox"
              checked={overlays.shortcuts}
              onChange={(e) =>
                onChange({ ...overlays, shortcuts: e.target.checked })
              }
              className={checkbox}
            />
            Shortcut spots
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-gray-900 dark:text-zinc-100">
            <input
              type="checkbox"
              checked={overlays.dens}
              onChange={(e) => onChange({ ...overlays, dens: e.target.checked })}
              className={checkbox}
            />
            Den rooms
          </label>
        </div>
      )}
    </div>
  );
};

export default OverlayToggles;
