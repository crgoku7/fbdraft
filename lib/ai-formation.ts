import type { Player } from "./player-data";
import { FORMATIONS, getPositionModifier, type FormationSlot } from "./formation-utils";

export type AssignedRoster = {
  player: Player;
  slotId: string;
};

export type OptimizedTeam = {
  formationId: string;
  roster: AssignedRoster[];
  totalScore: number;
};

function greedyAssign(players: Player[], formationSlots: FormationSlot[]): AssignedRoster[] {
  const availableSlots = [...formationSlots];
  const assigned: AssignedRoster[] = [];

  for (const player of players) {
    let bestSlotIdx = -1;
    let bestModifier = -1;

    for (let i = 0; i < availableSlots.length; i++) {
      const mod = getPositionModifier(player.positions, availableSlots[i].role).modifier;
      if (mod > bestModifier) {
        bestModifier = mod;
        bestSlotIdx = i;
      }
    }

    if (bestSlotIdx !== -1) {
      assigned.push({
        player,
        slotId: availableSlots[bestSlotIdx].id,
      });
      availableSlots.splice(bestSlotIdx, 1);
    }
  }

  return assigned;
}

function calculateRosterScore(roster: AssignedRoster[], slots: FormationSlot[]): number {
  return roster.reduce((sum, entry) => {
    const slot = slots.find(s => s.id === entry.slotId);
    if (!slot) return sum;
    const modifier = getPositionModifier(entry.player.positions, slot.role).modifier;
    return sum + (entry.player.rating * modifier);
  }, 0);
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function optimizeTeamFormation(players: Player[]): OptimizedTeam {
  let bestFormationId = FORMATIONS[0].id;
  let bestRoster: AssignedRoster[] = [];
  let highestScore = -1;

  for (const formation of FORMATIONS) {
    // Try deterministic (sorted by rating)
    const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);
    const deterministicAssignment = greedyAssign(sortedPlayers, formation.slots);
    const deterministicScore = calculateRosterScore(deterministicAssignment, formation.slots);

    if (deterministicScore > highestScore) {
      highestScore = deterministicScore;
      bestRoster = deterministicAssignment;
      bestFormationId = formation.id;
    }

    // Try 50 random shuffles to overcome greedy local maximums
    for (let i = 0; i < 50; i++) {
      const shuffled = shuffle(players);
      const randomAssignment = greedyAssign(shuffled, formation.slots);
      const score = calculateRosterScore(randomAssignment, formation.slots);
      if (score > highestScore) {
        highestScore = score;
        bestRoster = randomAssignment;
        bestFormationId = formation.id;
      }
    }
  }

  return {
    formationId: bestFormationId,
    roster: bestRoster,
    totalScore: highestScore,
  };
}
