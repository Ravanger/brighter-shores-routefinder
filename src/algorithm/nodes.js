/**
 * Starting point for the player.
 * All node numbers can be referenced in the brighter shores world map file mentioned in the code repositories README.
 */
export const bountyBoard = {
  name: "Guild Bounty Board",
  node: 103,
};

/**
 * The Express Bounty Board, in the South Player Market — the room directly
 * south of the Merchants' Guild, unlocked after The Imposter quest. Graph
 * node 59 is the waypoint at the room's north end, next to the board: the
 * board's wiki position is [429, 50] and 59 is the nearest waypoint to it
 * on the upstream map (node 50 is mid-room, node 51 is the south edge).
 * All node numbers can be referenced in the brighter shores world map file mentioned in the code repositories README.
 */
export const expressBountyBoard = {
  name: "Express Bounty Board",
  node: 59,
};

/**
 * Portals that players can teleport to.
 * All node numbers can be referenced in the brighter shores world map file mentioned in the code repositories README.
 */
export const portals = {
  CRENOPOLIS_MARKET: {
    name: "Crenopolis Market",
    node: 53,
    teleportTime: 8,
  },
  CRENOPOLIS_OUTSKIRTS: {
    name: "Crenopolis Outskirts",
    node: 54,
    teleportTime: 8,
  },
};

/**
 * Markets where players buy or sell bounty related items.
 * All node numbers can be referenced in the brighter shores world map file mentioned in the code repositories README.
 */
export const markets = {
  VICTOR_T_CYCLOPS: {
    name: "Victor T Cyclops",
    node: 8,
  },
  FORTUNEHOLD_FARM: {
    name: "Fortunehold Farm",
    node: 13,
  },
  BUTCHERS_STALL: {
    name: "Butcher's Stall",
    node: 16,
  },
  HERMARS_HOMEWARE: {
    name: "Hermar's Homeware",
    node: 18,
  },
  GREENGROCERS: {
    name: "Greengrocers",
    node: 21,
  },
  CLOCK_STALL: {
    name: "Clock Stall",
    node: 26,
  },
  JENNALERS_WINES: {
    name: "Jennaler's Wines",
    node: 31,
  },
  TOY_STALL: {
    name: "Toy Stall",
    node: 36,
  },
  CANDICES_CANDLES: {
    name: "Candice's Candles",
    node: 38,
  },
  HALLIGS_STREET_FOOD: {
    name: "Hallig's Street Food",
    node: 41,
  },
  CHEF: {
    name: "Chef",
    node: 44,
  },
  BERTS_GALLERY: {
    name: "Bert's Gallery",
    node: 57,
  },
  SOUVENIR_STALL: {
    name: "Souvenir Stall",
    node: 61,
  },
  BOGGS_ANTIQUES: {
    name: "Bogg's Antiques",
    node: 66,
  },
  TOMMY_SHOES_WINES: {
    name: "Tommy Shoes Wines",
    node: 69,
  },
  MONOCLE_MARKET: {
    name: "Monocle Market",
    node: 71,
  },
  FRANCESCAS_FRUIT_STALL: {
    name: "Francesca's Fruit Stall",
    node: 76,
  },
  SNILCHS_WATCHES: {
    name: "Snilch's Watches",
    node: 77,
  },
  SOAP_SHOP: {
    name: "Soap Shop",
    node: 81,
  },
  HENDERSONS_MEAT: {
    name: "Henderson's Meat",
    node: 83,
  },
  CHEESE_SHOP: {
    name: "Cheese Shop",
    node: 84,
  },
  VASE_STALL: {
    name: "Vase Stall",
    node: 85,
  },
  PENNYS_CLOCKWORK: {
    name: "Penny's Clockwork",
    node: 86,
  },
  JANESSAS_DELICACIES: {
    name: "Janessa's Delicacies",
    node: 102,
  },
  TEXTILES_STALL: {
    name: "Textiles Stall",
    node: 104,
  },
  CABBAGE_STALL: {
    name: "Cabbage Stall",
    node: 118
  },
  PEARL_STALL: {
    name: "Pearl Stall",
    node: 119
  },
};

/**
 * Any nodes not already defined above represent the "doors" between rooms.
 * For example, the pathway between Waterfront and Tanners Road is represented by node #35.
 * All node numbers can be referenced in the brighter shores world map file mentioned in the code repositories README.
 *
 * `weight` is the time in seconds it takes to travel between the two nodes.
 *
 * `directed` edges are one-way paths that take longer to travel in one direction than the other.
 *    This is the case for example in Lord's Road West, where you must pass through a doorway to get to the other side.
 *
 * `hostile` edges are paths where you may get attacked by mobs.
 *
 * `detectiveMilestone` edges are City Shortcuts, unlocked at a Detective
 * milestone (see `cityShortcuts`). An edge is only usable once the player's
 * Detective milestone reaches the edge's required milestone. City Shortcuts
 * unlock at the start of a milestone, so only the milestone matters, not the
 * within-milestone level.
 *
 * `crimeDen` edges go through a Crime Den Raid room (see `crimeDens` and
 * `denRooms`). Each den passage is two half-edges, street → room node →
 * street; the room node sits at the room's wiki polygon centre
 * (nodePositions.js) and is where the route map draws the walk line and
 * marks the den dot. An edge is only usable when that den is in the enabled
 * list passed to GPS (see `getEnabledCrimeDens`).
 *
 * `quest` edges are passages that open once a quest is complete (see
 * `questRooms`): each passage is a street → room node → street pair, the
 * room node sitting at the room's wiki polygon centre (nodePositions.js),
 * so the route map bends the walk line through the room.
 *
 * `portal` edges are paths that connect to a portal stone.
 *
 * When filling this out, always start with the lower node number and work your way up.
 * For example, when examining node 50, look only for any neighboring nodes that are *higher* than 50.
 *   This could be [50, 56], [50, 59], etc.
 *   In the case of [50, 49] - this should not be included as 49 is lower than 50 and
 *   should already be filled out by node [49, 50] instead.
 * The only exception to this is if the edge is directed, then both lower and higher node numbers have to be considered.
 *   For example, [1, 2] and [2, 1] are both represented since the edge is directed.
 *
 * This method makes it much easier to validate the nodes since they are always in order.
 */
export const edges = [
  { nodes: [1, 2], weight: 7.58, directed: true },
  { nodes: [1, 9], weight: 5.99 },
  { nodes: [1, 54], weight: 4.17, portal: true },

  // [2, 1] not needed
  { nodes: [2, 9], weight: 4.21, directed: true },
  { nodes: [2, 3], weight: 4.43, directed: true },

  { nodes: [3, 2], weight: 8.32, directed: true },
  {
    nodes: [3, 4],
    weight: 7.43,
    hostile: true,
    chanceOfEncounter: 0.15,
    timeToResolve: 7.5,
  },

  {
    nodes: [4, 5],
    weight: 6.0,
    hostile: true,
    chanceOfEncounter: 0.15,
    timeToResolve: 7.5,
  },

  { nodes: [5, 6], weight: 2.96 },

  { nodes: [6, 7], weight: 4.62 },
  { nodes: [6, 84], weight: 3.43 },

  { nodes: [7, 8], weight: 2.01 },

  { nodes: [9, 2], weight: 9.32, directed: true },
  { nodes: [9, 10], weight: 3.91 },
  { nodes: [9, 14], weight: 4.4 },

  { nodes: [10, 11], weight: 8.05 },
  { nodes: [10, 14], weight: 3.43 },

  { nodes: [11, 12], weight: 7.9 },

  { nodes: [12, 13], weight: 5.83 },
  { nodes: [12, 106], weight: 5.68 },

  { nodes: [13, 106], weight: 7.35 },

  { nodes: [14, 15], weight: 9.84, directed: true },

  { nodes: [15, 14], weight: 5.64, directed: true },
  { nodes: [15, 16], weight: 3.66, directed: true },
  { nodes: [15, 17], weight: 2.83, directed: true },

  { nodes: [16, 15], weight: 10.1, directed: true },
  { nodes: [16, 17], weight: 3.28 },
  { nodes: [16, 72], weight: 4.12 },
  { nodes: [16, 87], weight: 4.25 },

  { nodes: [17, 15], weight: 9.02, directed: true },
  { nodes: [17, 18], weight: 5.01 },
  { nodes: [17, 19], weight: 5.32 },
  { nodes: [17, 72], weight: 6.57 },
  { nodes: [17, 87], weight: 7.39 },

  { nodes: [18, 19], weight: 0.86 },

  { nodes: [19, 20], weight: 6.6 },
  { nodes: [19, 22], weight: 6.52 },
  { nodes: [19, 118], weight: 1.4 },

  { nodes: [20, 21], weight: 2.05 },
  { nodes: [20, 22], weight: 3.2 },
  { nodes: [20, 92], weight: 3.73 },
  { nodes: [20, 118], weight: 6.01 },

  { nodes: [21, 92], weight: 2.18 },

  { nodes: [22, 118], weight: 5.19 },
  {
    nodes: [22, 23],
    weight: 4.13,
    hostile: true,
    chanceOfEncounter: 0.15,
    timeToResolve: 7.5,
  },

  {
    nodes: [23, 24],
    weight: 2.68,
    hostile: true,
    chanceOfEncounter: 0.15,
    timeToResolve: 7.5,
  },

  { nodes: [24, 25], weight: 5.9 },
  { nodes: [24, 27], weight: 7.03 },
  { nodes: [24, 112], weight: 6.31 },

  { nodes: [25, 26], weight: 2.0 },
  { nodes: [25, 27], weight: 2.1 },
  { nodes: [25, 112], weight: 2.04 },

  { nodes: [27, 28], weight: 4.54 },
  { nodes: [27, 112], weight: 2.37 },

  { nodes: [28, 29], weight: 2.39 },
  { nodes: [28, 33], weight: 4.82 },
  { nodes: [28, 94], weight: 8.39 },

  // Smugglers passage via the Geld Family Residence (measured 5s total).
  { nodes: [29, 126], weight: 2.5, crimeDen: "SMUGGLERS" },
  { nodes: [30, 126], weight: 2.5, crimeDen: "SMUGGLERS" },
  { nodes: [29, 94], weight: 7.5 },

  { nodes: [30, 31], weight: 4.77 },
  { nodes: [30, 34], weight: 6.71 },
  { nodes: [30, 104], weight: 5.28 },

  { nodes: [31, 32], weight: 3.08 },
  { nodes: [31, 34], weight: 3.2 },
  { nodes: [31, 104], weight: 2.44 },

  { nodes: [32, 34], weight: 3.71 },
  // Smugglers passage via the Geld Family Logistics (measured 4.07s total).
  { nodes: [32, 127], weight: 2.035, crimeDen: "SMUGGLERS" },
  { nodes: [33, 127], weight: 2.035, crimeDen: "SMUGGLERS" },
  { nodes: [32, 104], weight: 2.2 },

  { nodes: [33, 94], weight: 4.27 },

  { nodes: [34, 35], weight: 6.83 },
  { nodes: [34, 37], weight: 4.75 },
  { nodes: [34, 104], weight: 1.4 },

  { nodes: [35, 36], weight: 4.2 },
  { nodes: [35, 37], weight: 5.44 },
  { nodes: [35, 48], weight: 7.69 },
  // { nodes: [35, 93] }, Not needed

  { nodes: [36, 48], weight: 3.92 },
  // { nodes: [36, 93] }, Not needed

  { nodes: [37, 38], weight: 4.91 },
  { nodes: [37, 39], weight: 10.34 },
  { nodes: [37, 94], weight: 6.7 },

  { nodes: [38, 39], weight: 5.89 },
  { nodes: [38, 94], weight: 2.56 },

  { nodes: [39, 40], weight: 5.22 },
  { nodes: [39, 45], weight: 4.27 },
  { nodes: [39, 94], weight: 7.02 },

  { nodes: [40, 41], weight: 6.16 },
  { nodes: [40, 42], weight: 5.21 },
  { nodes: [40, 45], weight: 3.11 },
  { nodes: [40, 90], weight: 6.68 },
  { nodes: [40, 91], weight: 6.49 },
  { nodes: [40, 95], weight: 3.78 },

  { nodes: [41, 42], weight: 5.84 },
  { nodes: [41, 90], weight: 4.02 },
  { nodes: [41, 91], weight: 2.38 },
  { nodes: [41, 95], weight: 4.65 },

  { nodes: [42, 43], weight: 5.42 },
  { nodes: [42, 90], weight: 3.89 },
  { nodes: [42, 91], weight: 8.01 },
  { nodes: [42, 95], weight: 6.75 },

  { nodes: [43, 44], weight: 1.54 },

  { nodes: [45, 46], weight: 3.81 },

  { nodes: [46, 47], weight: 9.78 },

  { nodes: [47, 48], weight: 7.0 },
  { nodes: [47, 49], weight: 10.71 },
  { nodes: [47, 52], weight: 10.39 },

  { nodes: [48, 49], weight: 11.01 },
  { nodes: [48, 52], weight: 10.69 },
  // { nodes: [48, 93] }, Not needed

  // { nodes: [49, 52] }, Not needed
  // Burglars passage via the Market Chambers (measured 5s total).
  { nodes: [49, 130], weight: 2.5, crimeDen: "BURGLARS" },
  { nodes: [50, 130], weight: 2.5, crimeDen: "BURGLARS" },

  // { nodes: [50, 51] }, Not needed
  { nodes: [50, 56], weight: 6.87 },
  { nodes: [50, 59], weight: 4.4 },
  { nodes: [50, 100], weight: 7.12 },

  // Burglars passage via Oscen's Warehouse (measured 4.43s total).
  { nodes: [51, 131], weight: 2.215, crimeDen: "BURGLARS" },
  { nodes: [52, 131], weight: 2.215, crimeDen: "BURGLARS" },
  { nodes: [51, 56], weight: 6.34 },
  { nodes: [51, 59], weight: 6.3 },
  { nodes: [51, 100], weight: 7.29 },

  { nodes: [53, 55], weight: 2.56, portal: true },

  { nodes: [55, 56], weight: 3.26 },
  { nodes: [55, 58], weight: 4.69 },
  { nodes: [55, 82], weight: 10.0 },
  { nodes: [55, 96], weight: 10.05 },

  { nodes: [56, 58], weight: 4.92 },
  { nodes: [56, 59], weight: 5.12 },
  { nodes: [56, 82], weight: 9.37 },
  { nodes: [56, 96], weight: 8.78 },
  { nodes: [56, 100], weight: 2.63 },

  { nodes: [57, 58], weight: 1.94 },

  { nodes: [58, 82], weight: 7.69 },
  { nodes: [58, 96], weight: 8.43 },

  { nodes: [59, 60], weight: 4.92 },
  { nodes: [59, 62], weight: 8.77 },
  { nodes: [59, 64], weight: 9.47 },
  { nodes: [59, 97], weight: 8.56 },
  { nodes: [59, 99], weight: 5.46 },
  { nodes: [59, 100], weight: 4.7 },

  { nodes: [60, 61], weight: 2.87 },
  { nodes: [60, 62], weight: 5.6 },
  { nodes: [60, 64], weight: 6.94 },
  { nodes: [60, 95], weight: 6.36 },
  { nodes: [60, 97], weight: 6.56 },
  { nodes: [60, 99], weight: 5.32 },

  { nodes: [61, 95], weight: 4.6 },

  // Counterfeiters passage via the Dilapidated Warehouse (measured 6.62s total).
  { nodes: [62, 128], weight: 3.31, crimeDen: "COUNTERFEITERS" },
  { nodes: [63, 128], weight: 3.31, crimeDen: "COUNTERFEITERS" },

  // { nodes: [63, 65] }, Not needed
  { nodes: [63, 67], weight: 5.06 },
  { nodes: [63, 101], weight: 6.77 },

  // Counterfeiters passage via the Slant Street Cart House (measured 7s total).
  { nodes: [64, 129], weight: 3.5, crimeDen: "COUNTERFEITERS" },
  { nodes: [65, 129], weight: 3.5, crimeDen: "COUNTERFEITERS" },
  { nodes: [64, 97], weight: 2.7 },
  { nodes: [64, 99], weight: 6.61 },

  { nodes: [65, 67], weight: 7.6 },
  { nodes: [65, 101], weight: 6.3 },

  { nodes: [66, 101], weight: 1.3 },

  { nodes: [67, 68], weight: 2.65 },
  { nodes: [67, 91], weight: 6.75 },
  { nodes: [67, 101], weight: 4.45 },
  { nodes: [67, 119], weight: 4.33 },

  { nodes: [68, 69], weight: 3.15 },
  { nodes: [68, 70], weight: 8.54 },
  { nodes: [68, 113], weight: 5.65 },
  { nodes: [68, 116], weight: 8.27 },
  { nodes: [68, 119], weight: 4.32 },

  { nodes: [69, 70], weight: 5.42 },
  { nodes: [69, 113], weight: 2.09 },
  { nodes: [69, 116], weight: 4.95 },

  { nodes: [70, 71], weight: 7.32 },
  { nodes: [70, 113], weight: 6.1 },
  { nodes: [70, 116], weight: 2.51 },

  { nodes: [72, 87], weight: 3.83 },
  { nodes: [72, 73], weight: 4.96 },

  { nodes: [73, 74], weight: 5.3 },

  { nodes: [74, 75], weight: 2.65 },
  { nodes: [74, 78], weight: 3.83 },

  { nodes: [75, 76], weight: 3.95 },
  { nodes: [75, 77], weight: 4.55 },
  { nodes: [75, 78], weight: 4.48 },
  { nodes: [75, 105], weight: 8.47, directed: true },

  { nodes: [76, 77], weight: 2.52 },
  { nodes: [76, 105], weight: 5.65, directed: true },

  { nodes: [77, 105], weight: 3.43, directed: true },

  { nodes: [78, 79], weight: 6.15 },

  { nodes: [79, 80], weight: 3.14 },
  { nodes: [79, 117], weight: 5.28 },

  { nodes: [80, 81], weight: 1.23 },
  { nodes: [80, 117], weight: 4.6 },

  { nodes: [82, 83], weight: 1.75 },
  { nodes: [82, 96], weight: 4.61 },

  { nodes: [85, 87], weight: 6.42 },
  { nodes: [85, 88], weight: 1.77 },
  { nodes: [85, 92], weight: 5.26 },

  { nodes: [86, 88], weight: 2.96 },
  { nodes: [86, 89], weight: 4.51 },
  { nodes: [86, 111], weight: 3.1 },

  { nodes: [87, 88], weight: 7.61 },
  { nodes: [87, 92], weight: 3.09 },

  { nodes: [88, 89], weight: 6.85 },
  { nodes: [88, 92], weight: 6.51 },
  { nodes: [88, 111], weight: 4.68 },

  { nodes: [89, 90], weight: 4.92 },
  { nodes: [89, 111], weight: 3.68 },

  { nodes: [90, 91], weight: 5.67 },
  { nodes: [90, 95], weight: 7.59 },

  { nodes: [91, 95], weight: 4.39 },
  { nodes: [91, 119], weight: 3.05 },

  { nodes: [96, 97], weight: 5.35 },
  { nodes: [96, 98], weight: 2.83 },

  { nodes: [97, 98], weight: 4.84 },
  { nodes: [97, 99], weight: 5.63 },

  { nodes: [98, 99], weight: 4.32 },
  { nodes: [98, 100], weight: 5.1 },
  { nodes: [98, 102], weight: 3.14 },
  { nodes: [98, 103], weight: 7.89 },

  { nodes: [99, 100], weight: 4.79 },
  { nodes: [99, 102], weight: 2.87 },
  { nodes: [99, 103], weight: 8.84 },

  { nodes: [100, 102], weight: 1.6 },
  { nodes: [100, 103], weight: 8.23 },

  { nodes: [102, 103], weight: 6.7 },

  { nodes: [105, 75], weight: 5.16, directed: true },
  { nodes: [105, 76], weight: 2.42, directed: true },
  { nodes: [105, 77], weight: 0.1, directed: true },
  // Abandoned Alleyway passage via the room node 136 (opens after the Battle
  // of Fortunehold; measured 6.34s / 9.6s per direction).
  {
    nodes: [105, 136],
    weight: 3.17,
    directed: true,
    quest: "BATTLE_OF_FORTUNEHOLD",
  },
  {
    nodes: [136, 106],
    weight: 3.17,
    directed: true,
    quest: "BATTLE_OF_FORTUNEHOLD",
  },

  {
    nodes: [106, 136],
    weight: 4.8,
    directed: true,
    quest: "BATTLE_OF_FORTUNEHOLD",
  },
  {
    nodes: [136, 105],
    weight: 4.8,
    directed: true,
    quest: "BATTLE_OF_FORTUNEHOLD",
  },

  // Muggers passage via the Four Winds Backroom (measured 3.19s total).
  { nodes: [107, 132], weight: 1.595, crimeDen: "MUGGERS" },
  { nodes: [108, 132], weight: 1.595, crimeDen: "MUGGERS" },
  // { nodes: [107, 109] }, Not needed
  { nodes: [107, 111], weight: 5.34 },

  // { nodes: [108, 110] }, Not needed
  { nodes: [108, 112], weight: 4.94 },

  // Muggers passage via the Four Winds Side Room (measured 2.57s total).
  { nodes: [109, 133], weight: 1.285, crimeDen: "MUGGERS" },
  { nodes: [110, 133], weight: 1.285, crimeDen: "MUGGERS" },
  { nodes: [109, 111], weight: 7.85 },

  { nodes: [110, 112], weight: 2.79 },

  // Gangsters passage via Gillad's House (measured 2.97s total).
  { nodes: [113, 134], weight: 1.485, crimeDen: "GANGSTERS" },
  { nodes: [114, 134], weight: 1.485, crimeDen: "GANGSTERS" },
  // { nodes: [113, 116] }, Not needed

  // { nodes: [114, 115] }, Not needed
  { nodes: [114, 117], weight: 6.49 },

  // Gangsters passage via The Quill Club (measured 6.1s total).
  { nodes: [115, 135], weight: 3.05, crimeDen: "GANGSTERS" },
  { nodes: [116, 135], weight: 3.05, crimeDen: "GANGSTERS" },
  { nodes: [115, 117], weight: 5.42 },

  // City Shortcuts are teleports between two rooms (see `cityShortcuts`),
  // unlocked at a Detective milestone; the walk to and from each spot is
  // the surrounding edges, the weight is the teleport itself.
  {
    nodes: [84, 107],
    weight: 2,
    detectiveMilestone: 5,
    cityShortcut: "Cellar",
  },
  { nodes: [48, 80], weight: 2, detectiveMilestone: 6, cityShortcut: "Sewer" },
  {
    nodes: [57, 71],
    weight: 2,
    detectiveMilestone: 7,
    cityShortcut: "Painting",
  },
  {
    nodes: [67, 118],
    weight: 2,
    detectiveMilestone: 8,
    cityShortcut: "Manhole",
  },
  {
    nodes: [26, 83],
    weight: 2,
    detectiveMilestone: 9,
    cityShortcut: "Trapdoor",
  },
];

/**
 * City Shortcuts (added to the game 29 September 2026) are Detective
 * profession interlink rewards: teleports between two rooms in Crenopolis,
 * one unlocked per Detective milestone from 5 onwards. Each is wired as an
 * edge in `edges` carrying its name and `detectiveMilestone`; the weight is
 * the ~2s teleport itself — the walk to and from each spot is the
 * surrounding edges.
 * Source: https://brightershoreswiki.org/w/City_Shortcut (the individual
 * variant pages list each shortcut's two locations).
 *
 * Endpoint node numbers, from the wiki map gadget's shortcut marker
 * coordinates (MediaWiki:Gadget-leaflet-wiki.js) matched to this repo's
 * graph. The street endpoints without a market of their own (107, 80, 48,
 * 67) have their position set to the shortcut's map glyph in
 * nodePositions.js; the market endpoints stand in for their teleport spot
 * (the nearest node to the marker), so re-verify them in-game if a route
 * looks off. The actual teleport spots for all ten endpoints are recorded
 * in nodePositions.js `shortcutSpotPositions` (the map draws its shortcut
 * lines and crossing legs from there):
 *   Cellar     84 (Unicorn Farm) <-> 107 (Snag Alley)
 *   Sewer      80 (Sludge Street) <-> 48 (Tanners Road)
 *   Painting   71 (Fillan's Living Room) <-> 57 (Bert's Gallery)
 *   Manhole    118 (Dusty Nook) <-> 67 (Slant Street)
 *   Trapdoor   83 (Council Office) <-> 26 (The Frog and Barnacle)
 */
export const cityShortcuts = [
  { name: "Cellar", milestone: 5, rooms: ["Unicorn Farm", "Snag Alley"] },
  { name: "Sewer", milestone: 6, rooms: ["Sludge Street", "Tanners Road"] },
  {
    name: "Painting",
    milestone: 7,
    rooms: ["Fillan's Living Room", "Bert's Gallery"],
  },
  { name: "Manhole", milestone: 8, rooms: ["Dusty Nook", "Slant Street"] },
  {
    name: "Trapdoor",
    milestone: 9,
    rooms: ["Council Office", "The Frog and Barnacle"],
  },
];

/**
 * Crime Den Raids are Detective activities in Crenopolis: five dens, each
 * with two rooms. Once a den's rooms have been raided they become a shortcut
 * between the two streets it connects: each room is its own graph node
 * (`denRooms`) and each passage is a street → room → street pair of
 * `crimeDen` edges in `edges`.
 * An edge is only usable when the player's Detective milestone and level
 * meet the den's requirement AND the player has ticked the den in
 * Configuration, because clearing a den needs combat level too.
 * Source: https://brightershoreswiki.org/w/Crime_Den_Raids
 */
export const crimeDens = [
  {
    key: "SMUGGLERS",
    name: "Smugglers",
    milestone: 0,
    level: 28,
    rooms: ["Geld Family Residence", "Geld Family Logistics"],
    connects: ["Waterfront Market", "Thimble Lane"],
  },
  {
    key: "COUNTERFEITERS",
    name: "Counterfeiters",
    milestone: 1,
    level: 33,
    rooms: ["Dilapidated Warehouse", "Slant Street Cart House"],
    connects: ["West Player Market", "Slant Street"],
  },
  {
    key: "BURGLARS",
    name: "Burglars",
    milestone: 2,
    level: 33,
    rooms: ["Market Chambers", "Oscen's Warehouse"],
    connects: ["South Player Market", "Ratmore Road"],
  },
  {
    key: "MUGGERS",
    name: "Muggers",
    milestone: 3,
    level: 33,
    rooms: ["Four Winds Backroom", "Four Winds Side Room"],
    connects: ["Four Winds Bar", "Snag Alley"],
  },
  {
    key: "GANGSTERS",
    name: "Gangsters",
    milestone: 4,
    level: 33,
    rooms: ["Gillad's House", "The Quill Club"],
    connects: ["Peacock Road Central", "Dawkin Court"],
  },
];

/**
 * The ten den rooms as graph nodes (126-135): each passage in `edges` is a
 * street → room node → street pair through its room node, whose position is
 * the room's wiki polygon centre (nodePositions.js, generated). The route
 * map draws the walk line through the room and marks the den dot there.
 *
 * Which passage goes through which room follows the order of each den's
 * `rooms` array — not yet confirmed in-game; re-check against the game map.
 */
export const denRooms = [
  { node: 126, den: "SMUGGLERS", room: "Geld Family Residence" },
  { node: 127, den: "SMUGGLERS", room: "Geld Family Logistics" },
  { node: 128, den: "COUNTERFEITERS", room: "Dilapidated Warehouse" },
  { node: 129, den: "COUNTERFEITERS", room: "Slant Street Cart House" },
  { node: 130, den: "BURGLARS", room: "Market Chambers" },
  { node: 131, den: "BURGLARS", room: "Oscen's Warehouse" },
  { node: 132, den: "MUGGERS", room: "Four Winds Backroom" },
  { node: 133, den: "MUGGERS", room: "Four Winds Side Room" },
  { node: 134, den: "GANGSTERS", room: "Gillad's House" },
  { node: 135, den: "GANGSTERS", room: "The Quill Club" },
];

/**
 * Rooms that open as passages once a quest is complete: each is its own
 * graph node at the room's wiki polygon centre (nodePositions.js,
 * generated), and its passage in `edges` is a street → room node → street
 * pair of `quest` edges, usable only when the quest is done. The route map
 * bends the walk line through the room.
 */
export const questRooms = [
  { node: 136, room: "Abandoned Alleyway", quest: "BATTLE_OF_FORTUNEHOLD" },
];

/**
 * Whether a Detective milestone and level meet a den's requirement. The same
 * comparison as {@link getEnabledCrimeDens} uses for bounties (see
 * `isBountyAvailable` in SelectBounties): a higher milestone beats any level
 * within it. Empty, undefined and null inputs count as 0, matching the
 * settings inputs while a field is blank.
 * @param den A den from {@link crimeDens}
 * @param detectiveMilestone The player's Detective milestone (0-9)
 * @param detectiveLevel The player's level within the milestone (0-99)
 * @returns {boolean} True if the requirement is met
 */
export const meetsCrimeDenRequirement = (
  den,
  detectiveMilestone,
  detectiveLevel,
) => {
  const milestone =
    detectiveMilestone === "" ||
    detectiveMilestone === undefined ||
    detectiveMilestone === null
      ? 0
      : detectiveMilestone;
  const level =
    detectiveLevel === "" ||
    detectiveLevel === undefined ||
    detectiveLevel === null
      ? 0
      : detectiveLevel;

  return (
    den.milestone < milestone ||
    (den.milestone === milestone && den.level <= level)
  );
};

/**
 * Determines which crime dens are usable as shortcuts: the den is ticked by
 * the player and its Detective requirement is met.
 * @param crimeDenToggles Object of { [key from {@link crimeDens}]: boolean }
 *   The player's per-den "I can clear this den" toggles; a missing key is off.
 * @param detectiveMilestone The player's Detective milestone (0-9)
 * @param detectiveLevel The player's level within the milestone (0-99)
 * @returns {string[]} Keys from {@link crimeDens} whose edges may be used
 */
export const getEnabledCrimeDens = (
  crimeDenToggles,
  detectiveMilestone,
  detectiveLevel,
) => {
  const toggles = crimeDenToggles ?? {};
  return crimeDens
    .filter(
      (den) =>
        toggles[den.key] === true &&
        meetsCrimeDenRequirement(den, detectiveMilestone, detectiveLevel),
    )
    .map((den) => den.key);
};

/**
 * Removes den toggles whose Detective requirement is no longer met, so a
 * checked den can never sit below its cutoff (the player may no longer have
 * the level needed to clear it). Reuses {@link getEnabledCrimeDens}: what is
 * kept is exactly what is enabled.
 * @param crimeDenToggles Object of { [key from {@link crimeDens}]: boolean }
 *   The player's per-den "I can clear this den" toggles; a missing key is off.
 * @param detectiveMilestone The player's Detective milestone (0-9)
 * @param detectiveLevel The player's level within the milestone (0-99)
 * @returns {Object.<string, boolean>} The toggles to keep, all true
 */
export const pruneCrimeDenToggles = (
  crimeDenToggles,
  detectiveMilestone,
  detectiveLevel,
) => {
  const kept = {};
  for (const key of getEnabledCrimeDens(
    crimeDenToggles,
    detectiveMilestone,
    detectiveLevel,
  )) {
    kept[key] = true;
  }
  return kept;
};
