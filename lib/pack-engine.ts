import { type Player } from "./player-data";
import { FORMATIONS } from "./formation-utils";

export type PackDraftState = {
  userRoster: { player: Player; slotId: string | null }[];
  completed: boolean;
};

// Shuffle helper
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate a pack of 5 players biased towards a specific role/position
export function generatePack(targetRole: string, allPlayers: Player[], excludePlayerIds: Set<number>): Player[] {
  const available = allPlayers.filter(p => !excludePlayerIds.has(p.id));
  
  if (targetRole === "BENCH" || targetRole === "ANY") {
    const pack: Player[] = [];
    const pool = shuffle(available);
    const highTierPool = pool.filter(p => p.rating >= 84);
    if (highTierPool.length > 0) {
      pack.push(highTierPool[0]);
    }
    const remainingPool = pool.filter(p => !pack.includes(p));
    while (pack.length < 5 && remainingPool.length > 0) {
      pack.push(remainingPool.pop()!);
    }
    return shuffle(pack);
  }

  const exactMatches = available.filter(p => p.positions.includes(targetRole));
  let relatedMatches: Player[] = [];
  
  if (targetRole === "GK") {
    relatedMatches = [];
  } else if (["CB", "LB", "RB", "LWB", "RWB"].includes(targetRole)) {
    relatedMatches = available.filter(p => !p.positions.includes(targetRole) && p.positions.some(pos => ["CB", "LB", "RB", "LWB", "RWB"].includes(pos)));
  } else if (["CDM", "CM", "CAM", "LM", "RM"].includes(targetRole)) {
    relatedMatches = available.filter(p => !p.positions.includes(targetRole) && p.positions.some(pos => ["CDM", "CM", "CAM", "LM", "RM"].includes(pos)));
  } else if (["LW", "RW", "CF", "ST"].includes(targetRole)) {
    relatedMatches = available.filter(p => !p.positions.includes(targetRole) && p.positions.some(pos => ["LW", "RW", "CF", "ST"].includes(pos)));
  }

  const pack: Player[] = [];
  
  // Guarantee at least 1 exact match if available
  const shuffledExact = shuffle(exactMatches);
  if (shuffledExact.length > 0) {
    pack.push(shuffledExact.pop()!);
  }

  // Pool of acceptable players
  const pool = [...shuffledExact, ...shuffle(relatedMatches)];
  
  // Try to add 1 high tier wildcard from the pool
  const highTierPool = pool.filter(p => p.rating >= 85 && !pack.includes(p));
  if (highTierPool.length > 0) {
    pack.push(highTierPool[0]);
  }

  // Fill the rest up to 5 from the pool
  const remainingPool = pool.filter(p => !pack.includes(p));
  while (pack.length < 5 && remainingPool.length > 0) {
    pack.push(remainingPool.pop()!);
  }
  
  // Fallback 1: If we STILL don't have 5 (e.g. GK where relatedMatches is empty), try any exact match again
  if (pack.length < 5) {
     const fallbackExact = shuffle(exactMatches.filter(p => !pack.includes(p)));
     while (pack.length < 5 && fallbackExact.length > 0) {
       pack.push(fallbackExact.pop()!);
     }
  }

  // Fallback 2: absolute desperation
  if (pack.length < 5) {
     const absoluteFallback = shuffle(available.filter(p => !pack.includes(p)));
     while (pack.length < 5 && absoluteFallback.length > 0) {
       pack.push(absoluteFallback.pop()!);
     }
  }

  return shuffle(pack);
}

// AI Team Generation
const AI_NAMES = [
  "Bavarian Giants", "Catalan Kings", "London Blues", "Manchester Reds",
  "Milano Devils", "Paris Princes", "Madrid Whites", "Turin Zebras",
  "Amsterdam Sons", "Lisbon Eagles"
];

type AITier = "ELITE" | "GOOD" | "AVERAGE";

export function generateAITeams(allPlayers: Player[], count: number, excludePlayerIds: Set<number>, teamSize:number = 11) {
  const teams: { id: string; name: string; isUser: boolean; roster: { player: Player; slotId: string | null }[]; formationId: string; budget: number }[] = [];
  const usedIds = new Set(excludePlayerIds);
  const shuffledNames = shuffle(AI_NAMES);

  for (let i = 0; i < count; i++) {
    const isElite = i < 2; // 2 Elite teams
    const isGood = i >= 2 && i < 5; // 3 Good teams
    const tier: AITier = isElite ? "ELITE" : isGood ? "GOOD" : "AVERAGE";
    
    const formation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];
    const roster: { player: Player; slotId: string | null }[] = [];

    for (const slot of formation.slots) {
      // Find a player for this slot based on tier
      const available = allPlayers.filter(p => !usedIds.has(p.id) && p.positions.includes(slot.role));
      
      let candidates = available;
      if (tier === "ELITE") candidates = available.filter(p => p.rating >= 85);
      if (tier === "GOOD") candidates = available.filter(p => p.rating >= 80 && p.rating < 88);
      if (tier === "AVERAGE") candidates = available.filter(p => p.rating < 83);
      
      // Fallback if strict tier filtering leaves no players
      if (candidates.length === 0) {
        candidates = available;
      }
      if (candidates.length === 0) {
        // Ultimate fallback: any player not used
        candidates = allPlayers.filter(p => !usedIds.has(p.id));
      }

      // Sort descending to get the best of the candidates, but add randomness
      candidates.sort((a, b) => b.rating - a.rating);
      // Pick one of the top 3
      const pickIdx = Math.floor(Math.random() * Math.min(3, candidates.length));
      const chosen = candidates[pickIdx];

      roster.push({ player: chosen, slotId: slot.id });
      usedIds.add(chosen.id);
    }

    while (roster.length < teamSize) {
      // Find remaining unused players for general bench filler
      const benchAvailable = allPlayers.filter(p => !usedIds.has(p.id));
      
      let candidates = benchAvailable;
      if (tier === "ELITE") candidates = benchAvailable.filter(p => p.rating >= 82);
      if (tier === "GOOD") candidates = benchAvailable.filter(p => p.rating >= 78);
      
      if (candidates.length === 0) candidates = benchAvailable;
      if (candidates.length === 0) candidates = allPlayers; // Absolute backup fallback

      candidates.sort((a, b) => b.rating - a.rating);
      const pickIdx = Math.floor(Math.random() * Math.min(5, candidates.length));
      const chosen = candidates[pickIdx];

      // Add as bench player (slotId is null, matching the behavior seen in shared-ui.tsx)
      roster.push({ player: chosen, slotId: null });
      usedIds.add(chosen.id);
    }

    teams.push({
      id: `pack_ai_${i+1}`,
      name: shuffledNames[i] || `FC AI ${i+1}`,
      isUser: false,
      roster,
      formationId: formation.id,
      budget: 0 // Budget unused in pack draft league
    });
  }

  return teams;
}
