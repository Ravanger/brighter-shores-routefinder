import { PriorityQueue } from "@datastructures-js/priority-queue";
import { edges, portals } from "./nodes.js";

/**
 * Calculates the shortest path between two nodes
 * For more information on nodes, see:
 *    {@link markets}
 *    {@link edges}
 *    {@link portals}
 */
class GPS {
  #adjacencyMap;
  #cache;
  #spots;

  constructor(
    detectiveMilestone,
    battleOfFortuneholdCompleted,
    enabledCrimeDens = [],
  ) {
    this.#adjacencyMap = new Map();
    this.#cache = new Map();
    this.#spots = new Set(
      edges.filter((edge) => edge.cityShortcut).flatMap((edge) => edge.nodes),
    );
    this.#buildAdjacencyMap(
      detectiveMilestone,
      battleOfFortuneholdCompleted,
      enabledCrimeDens,
    );
  }

  /**
   * Returns the shortest path between two nodes
   * @param node1 The name of a location. e.g, "Greengrocers"
   * @param node2 The name of a location. e.g, "Tanners Road"
   * @returns {{ distance: number, path: number[] }} The shortest distance between the two locations
   */
  distance(node1, node2) {
    const key = `${node1}-${node2}`;

    if (!this.#cache.has(key)) {
      const distance = this.#distance(node1, node2);
      this.#cache.set(key, distance);
    }

    return this.#cache.get(key);
  }

  #distance(node1, node2) {
    if (node1 === node2) {
      return { distance: 0, path: [node1] };
    }

    // A City Shortcut spot reached on foot can only be left by teleporting:
    // walking on from it would be a detour through the spot, so the search
    // state is the node plus whether it was walked into.
    const stateKey = (node, walkedIn) => (walkedIn ? `${node}w` : `${node}`);

    const pq = new PriorityQueue((a, b) => a.distance - b.distance);
    pq.enqueue({ distance: 0, node: node1, walkedIn: false });

    const distances = new Map([[stateKey(node1, false), 0]]);
    const previous = new Map();

    while (pq.size() > 0) {
      const { node, distance, walkedIn } = pq.dequeue();
      const key = stateKey(node, walkedIn);

      if (node === node2) {
        const path = this.#reconstructPath(previous, node1, key);
        return {
          distance,
          path,
        };
      }

      if (distance > distances.get(key)) {
        continue;
      }

      const neighbors = this.#adjacencyMap.get(node);
      for (let [neighbor, weight, walk] of neighbors) {
        if (walkedIn && walk) {
          continue;
        }

        const newDistance = distance + weight;
        const neighborWalkedIn = walk && this.#spots.has(neighbor);
        const neighborKey = stateKey(neighbor, neighborWalkedIn);

        // Only consider this path if it improves the known shortest distance
        if (newDistance >= (distances.get(neighborKey) ?? Infinity)) {
          continue;
        }

        distances.set(neighborKey, newDistance);
        previous.set(neighborKey, { key, node });

        pq.enqueue({
          node: neighbor,
          distance: newDistance,
          walkedIn: neighborWalkedIn,
        });
      }
    }

    throw new Error(`No path found between ${node1} and ${node2}`);
  }

  #reconstructPath(previous, start, targetKey) {
    const path = [Number.parseInt(targetKey)];
    for (
      let step = previous.get(targetKey);
      step;
      step = previous.get(step.key)
    ) {
      path.push(step.node);
    }
    path.reverse();
    return path[0] === start ? path : [];
  }

  #addEdge(node1, node2, weight, walk) {
    if (!this.#adjacencyMap.has(node1)) {
      this.#adjacencyMap.set(node1, []);
    }

    const neighbors = this.#adjacencyMap.get(node1);

    // Duplicate edge prevention, if an edge already exists between two nodes, keep the existing edge
    for (const [neighbor, existingWeight] of neighbors) {
      if (neighbor === node2) {
        console.warn(
          `Edge between ${node1} and ${node2} already exists. Keeping existing edge with weight ${existingWeight}`,
        );
        return;
      }
    }

    neighbors.push([node2, weight, walk]);
  }

  #buildAdjacencyMap(
    detectiveMilestone,
    battleOfFortuneholdCompleted,
    enabledCrimeDens,
  ) {
    for (const edge of edges) {
      const [node1, node2] = edge.nodes;

      // If an edge is a City Shortcut that unlocks at a higher Detective
      // milestone than the current one, skip the edge
      if (edge.detectiveMilestone > detectiveMilestone) {
        continue;
      }

      // If an edge requires a quest to be completed that is not yet complete, skip the edge
      // (Battle of Fortunehold is the only quest that affects the graph as of now)
      if (edge.quest && !battleOfFortuneholdCompleted) {
        continue;
      }

      // If an edge goes through a crime den room whose den is not enabled, skip the edge
      if (edge.crimeDen && !enabledCrimeDens.includes(edge.crimeDen)) {
        continue;
      }

      // If an edge is in a hostile zone, add additional weight to the edge to represent the chance of an encounter
      const weight = edge.hostile
        ? edge.weight + edge.chanceOfEncounter * edge.timeToResolve
        : edge.weight;

      const walk = !edge.cityShortcut;
      this.#addEdge(node1, node2, weight, walk);

      if (!edge.directed) {
        this.#addEdge(node2, node1, weight, walk);
      }
    }

    // Portal zones can be travelled to from any other node
    for (let node of this.#adjacencyMap.keys()) {
      Object.entries(portals).forEach(([, portal]) => {
        this.#addEdge(node, portal.node, portal.teleportTime, false);
      });
    }
  }
}

export default GPS;
