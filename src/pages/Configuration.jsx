import Page from "../components/Page.jsx";
import Paragraph from "../components/Paragraph.jsx";
import Subheading from "../components/Subheading.jsx";
import useSettings from "../hooks/useSettings.js";
import {
  cityShortcuts,
  crimeDens as crimeDenList,
  meetsCrimeDenRequirement,
} from "../algorithm/nodes.js";

const Configuration = () => {
  const {
    merchantingMilestone,
    merchantingLevel,
    detectiveMilestone,
    detectiveLevel,
    battleOfFortuneholdCompleted,
    roundTrip,
    expressBountyBoard,
    crimeDens,
    setMerchantingMilestone,
    setMerchantingLevel,
    setDetectiveMilestone,
    setDetectiveLevel,
    setBattleOfFortuneholdCompleted,
    setRoundTrip,
    setExpressBountyBoard,
    setCrimeDenEnabled,
  } = useSettings();

  return (
    <Page
      title="Configuration"
      meta="Settings for the tool are saved to your browser."
    >
      <Subheading>Merchanting Milestone and Level</Subheading>
      <Paragraph>
        Used to hide bounties that require a higher merchanting milestone and
        level. Leave the milestone blank to show all bounties.
      </Paragraph>

      <div className="flex gap-3 mb-5">
        <label className="block">
          <span className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            Milestone
          </span>
          <input
            value={merchantingMilestone}
            onChange={(e) => setMerchantingMilestone(e.target.value)}
            type="number"
            min="0"
            max="9"
            className="block p-2 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800 sm:text-md focus:ring-blue-500 focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            Level
          </span>
          <input
            value={merchantingLevel}
            onChange={(e) => setMerchantingLevel(e.target.value)}
            type="number"
            min="0"
            max="99"
            className="block p-2 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800 sm:text-md focus:ring-blue-500 focus:border-blue-500"
          />
        </label>
      </div>

      <Subheading>Detective Milestone and Level</Subheading>
      <Paragraph>
        City Shortcuts are alternate routes through Crenopolis, unlocked one
        per Detective milestone from milestone 5 onwards. Set your milestone
        so the tool knows which shortcuts you have unlocked.
      </Paragraph>

      <div className="flex gap-3 mb-5">
        <label className="block">
          <span className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            Milestone
          </span>
          <input
            value={detectiveMilestone}
            onChange={(e) => setDetectiveMilestone(e.target.value)}
            type="number"
            min="0"
            max="9"
            className="block p-2 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800 sm:text-md focus:ring-blue-500 focus:border-blue-500"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            Level
          </span>
          <input
            value={detectiveLevel}
            onChange={(e) => setDetectiveLevel(e.target.value)}
            type="number"
            min="0"
            max="99"
            className="block p-2 text-gray-900 dark:text-white border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800 sm:text-md focus:ring-blue-500 focus:border-blue-500"
          />
        </label>
      </div>

      <Paragraph className="mb-5 dark:text-zinc-300">
        <div className="font-semibold mb-2">City Shortcuts unlocked:</div>
        <ul className="list-disc ml-5">
          {detectiveMilestone < 5 && <li className="mb-2">None.</li>}
          {cityShortcuts.map(
            ({ milestone, name, endpoints }) =>
              detectiveMilestone >= milestone && (
                <li key={milestone} className="mb-2">
                  {name}: {endpoints.map((endpoint) => endpoint.room).join(" and ")}{" "}
                </li>
              ),
          )}
        </ul>
      </Paragraph>

      <Subheading>Crime Den Raids</Subheading>
      <Paragraph>
        Raiding a crime den opens its rooms as a shortcut through Crenopolis.
        Each den needs the Detective level shown, and you must be able to
        defeat its enemies. Only tick the dens you can clear.
      </Paragraph>

      {crimeDenList.map((den) => {
        const meetsRequirement = meetsCrimeDenRequirement(
          den,
          detectiveMilestone,
          detectiveLevel,
        );
        return (
          <div key={den.key} className="flex items-center mb-4 select-none">
            <input
              id={`crime-den-${den.key.toLowerCase()}`}
              type="checkbox"
              checked={crimeDens[den.key] === true}
              disabled={!meetsRequirement}
              onChange={(e) => setCrimeDenEnabled(den.key, e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
            />
            <label
              htmlFor={`crime-den-${den.key.toLowerCase()}`}
              className={`ms-2 text-sm font-medium text-gray-900 dark:text-white cursor-pointer ${meetsRequirement ? "" : "opacity-50"}`}
            >
              {den.name}: {den.connects.join(" ↔ ")} (milestone {den.milestone}
              , level {den.level})
              {!meetsRequirement && (
                <span className="text-xs">
                  {" "}
                  — requires Detective milestone {den.milestone}, level{" "}
                  {den.level}
                </span>
              )}
            </label>
          </div>
        );
      })}

      <Subheading>Quests</Subheading>
      <Paragraph>
        Some quests unlock new rooms. It is{" "}
        <span className="font-bold">highly recommended</span> to check any
        completed quests, or the tool will not take them into account.
      </Paragraph>

      <div className="flex items-center mb-4 select-none">
        <input
          id="battle-of-fortunehold"
          type="checkbox"
          checked={battleOfFortuneholdCompleted}
          onChange={(e) => setBattleOfFortuneholdCompleted(e.target.checked)}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
        />
        <label
          htmlFor="battle-of-fortunehold"
          className="ms-2 text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
        >
          Battle of Fortunehold
        </label>
      </div>

      <Subheading>Round Trips</Subheading>
      <Paragraph>
        If enabled, the tool will find the best route to complete all bounties
        and return to the bounty board. This may be slightly different from the
        fastest route to complete all bounties, but it is more efficient if you
        plan on making multiple trips.
      </Paragraph>

      <div className="flex items-center mb-4 select-none">
        <input
          id="roundtrips"
          type="checkbox"
          checked={roundTrip}
          onChange={(e) => setRoundTrip(e.target.checked)}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
        />
        <label
          htmlFor="roundtrips"
          className="ms-2 text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
        >
          Round Trips
        </label>
      </div>

      <Subheading>Bounty Board</Subheading>
      <Paragraph>
        After The Imposter quest, the Express Bounty Board in the South
        Player Market offers a different set of bounties and sits closer to
        the teleport than the Guild Bounty Board. If enabled, routes start
        and end there instead.
      </Paragraph>

      <div className="flex items-center mb-4 select-none">
        <input
          id="express-bounty-board"
          type="checkbox"
          checked={expressBountyBoard}
          onChange={(e) => setExpressBountyBoard(e.target.checked)}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
        />
        <label
          htmlFor="express-bounty-board"
          className="ms-2 text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
        >
          Express bounty board
        </label>
      </div>

      <Paragraph className="mt-10">
        Your settings are saved automatically when changed.
      </Paragraph>
    </Page>
  );
};

export default Configuration;
