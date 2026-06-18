import type { Player } from "./player-data";
import { getPositionModifier, FORMATIONS, type FormationSlot } from "./formation-utils";

export type MatchEvent = {
  minute: number;
  type: "GOAL" | "YELLOW_CARD" | "RED_CARD" | "INJURY";
  teamId: number;
  playerId: number;
  playerName: string;
  assistPlayerId?: number;
  assistPlayerName?: string;
};

export type MatchResult = {
  homeTeamId: number;
  awayTeamId: number;
  homeGoals: number;
  awayGoals: number;
  homeXg: number;
  awayXg: number;
  events: MatchEvent[];
};

type TeamInput = {
  id: number;
  roster: { player: Player; slotId?: string }[];
  formationId: string;
};

// Calculate effective ratings of the roster
function getEffectiveRoster(team: TeamInput) {
  const formation = FORMATIONS.find(f => f.id === team.formationId) || FORMATIONS[0];
  
  return team.roster.map(entry => {
    const slot = formation.slots.find(s => s.id === entry.slotId);
    const role = slot ? slot.role : "CM"; // default fallback
    const mod = getPositionModifier(entry.player.positions, role).modifier;
    return {
      ...entry.player,
      effectiveRating: entry.player.rating * mod,
      role
    };
  });
}

function calculateStrengths(effectiveRoster: ReturnType<typeof getEffectiveRoster>, formationId: string) {
  let attack = 0;
  let midfield = 0;
  let defense = 0;
  let gk = 50;

  for (const p of effectiveRoster) {
    if (["ST", "LW", "RW", "CF", "CAM"].includes(p.role)) attack += p.effectiveRating;
    if (["CM", "CDM", "LM", "RM", "CAM"].includes(p.role)) midfield += p.effectiveRating;
    if (["CB", "LB", "RB", "LWB", "RWB", "CDM"].includes(p.role)) defense += p.effectiveRating;
    if (p.role === "GK") gk = p.effectiveRating;
  }

  // Goalkeeper impact
  defense = (0.75 * defense) + (0.25 * gk);

  // Formation bonuses
  if (formationId === "4-3-3") attack *= 1.05;
  if (formationId === "4-5-1") defense *= 1.05;
  if (formationId === "4-2-3-1") midfield *= 1.05;
  if (formationId === "3-5-2") midfield *= 1.05;
  if (formationId === "5-3-2") defense *= 1.05;
  if (formationId === "4-4-2") { attack *= 1.02; defense *= 1.02; }

  // Prevent divide by zero
  return {
    attack: Math.max(attack, 1),
    midfield: Math.max(midfield, 1),
    defense: Math.max(defense, 1),
    gk: Math.max(gk, 1)
  };
}

// Simple Poisson distribution for goal generation
function getPoissonGoals(xg: number): number {
  const L = Math.exp(-xg);
  let p = 1.0;
  let k = 0;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

export function simulateMatch(homeTeam: TeamInput, awayTeam: TeamInput): MatchResult {
  const homeEff = getEffectiveRoster(homeTeam);
  const awayEff = getEffectiveRoster(awayTeam);

  const homeStr = calculateStrengths(homeEff, homeTeam.formationId);
  const awayStr = calculateStrengths(awayEff, awayTeam.formationId);

  // Home advantage + relative strength
  const homeMidShare = homeStr.midfield / (homeStr.midfield + awayStr.midfield);
  const awayMidShare = 1 - homeMidShare;

  // xG calculation
  const homeXg = Math.max(0.1, (homeStr.attack / awayStr.defense) * 1.2 * homeMidShare * 2.5);
  const awayXg = Math.max(0.1, (awayStr.attack / homeStr.defense) * 0.9 * awayMidShare * 2.5);

  const homeGoals = getPoissonGoals(homeXg);
  const awayGoals = getPoissonGoals(awayXg);

  const events: MatchEvent[] = [];

  // Helper to pick a scorer weighted by effective rating and traits
  const pickScorer = (roster: typeof homeEff, roles: string[], minute: number) => {
    const eligible = roster.filter(r => roles.includes(r.role));
    const pool = eligible.length > 0 ? eligible : roster;
    
    let totalWeight = 0;
    const weights = pool.map(p => {
      let w = p.effectiveRating;
      if (p.traits.includes("Finesse Shot")) w *= 1.05;
      if (p.traits.includes("Aerial")) w *= 1.05;
      if (minute >= 75 && p.traits.includes("Gamechanger")) w *= 1.10;
      totalWeight += w;
      return w;
    });

    let rand = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      rand -= weights[i];
      if (rand <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  };

  // Helper to pick an assister weighted by effective rating and playmaking traits
  const pickAssister = (roster: typeof homeEff, roles: string[]) => {
    const eligible = roster.filter(r => roles.includes(r.role));
    const pool = eligible.length > 0 ? eligible : roster;
    
    let totalWeight = 0;
    const weights = pool.map(p => {
      let w = p.effectiveRating;
      if (p.traits.includes("Incisive Pass")) w *= 1.10;
      if (p.traits.includes("Playmaker")) w *= 1.10;
      totalWeight += w;
      return w;
    });

    let rand = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      rand -= weights[i];
      if (rand <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  };

  const pickRandomPlayer = (roster: typeof homeEff) => roster[Math.floor(Math.random() * roster.length)];

  // Generate Goal Events
  for (let i = 0; i < homeGoals; i++) {
    const minute = Math.floor(Math.random() * 90) + 1;
    const scorer = pickScorer(homeEff, ["ST", "LW", "RW", "CF", "CAM", "CM", "LM", "RM"], minute);
    const assister = Math.random() > 0.3 ? pickAssister(homeEff, ["CM", "CAM", "LM", "RM", "LW", "RW", "LWB", "RWB"]) : undefined;
    
    events.push({
      minute,
      type: "GOAL",
      teamId: homeTeam.id,
      playerId: scorer.id,
      playerName: scorer.name,
      assistPlayerId: assister?.id !== scorer.id ? assister?.id : undefined,
      assistPlayerName: assister?.id !== scorer.id ? assister?.name : undefined,
    });
  }

  for (let i = 0; i < awayGoals; i++) {
    const minute = Math.floor(Math.random() * 90) + 1;
    const scorer = pickScorer(awayEff, ["ST", "LW", "RW", "CF", "CAM", "CM", "LM", "RM"], minute);
    const assister = Math.random() > 0.3 ? pickAssister(awayEff, ["CM", "CAM", "LM", "RM", "LW", "RW", "LWB", "RWB"]) : undefined;
    
    events.push({
      minute,
      type: "GOAL",
      teamId: awayTeam.id,
      playerId: scorer.id,
      playerName: scorer.name,
      assistPlayerId: assister?.id !== scorer.id ? assister?.id : undefined,
      assistPlayerName: assister?.id !== scorer.id ? assister?.name : undefined,
    });
  }

  // Cards & Injuries (Random flavor)
  const numYellows = Math.floor(Math.random() * 4);
  for (let i = 0; i < numYellows; i++) {
    const teamId = Math.random() > 0.5 ? homeTeam.id : awayTeam.id;
    const player = pickRandomPlayer(teamId === homeTeam.id ? homeEff : awayEff);
    events.push({
      minute: Math.floor(Math.random() * 90) + 1,
      type: "YELLOW_CARD",
      teamId,
      playerId: player.id,
      playerName: player.name,
    });
  }

  const numReds = Math.random() > 0.85 ? 1 : 0;
  for (let i = 0; i < numReds; i++) {
    const teamId = Math.random() > 0.5 ? homeTeam.id : awayTeam.id;
    const player = pickRandomPlayer(teamId === homeTeam.id ? homeEff : awayEff);
    events.push({
      minute: Math.floor(Math.random() * 90) + 1,
      type: "RED_CARD",
      teamId,
      playerId: player.id,
      playerName: player.name,
    });
  }

  const numInjuries = Math.random() > 0.9 ? 1 : 0;
  for (let i = 0; i < numInjuries; i++) {
    const teamId = Math.random() > 0.5 ? homeTeam.id : awayTeam.id;
    const player = pickRandomPlayer(teamId === homeTeam.id ? homeEff : awayEff);
    events.push({
      minute: Math.floor(Math.random() * 90) + 1,
      type: "INJURY",
      teamId,
      playerId: player.id,
      playerName: player.name,
    });
  }

  // Sort events by minute
  events.sort((a, b) => a.minute - b.minute);

  return {
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeGoals,
    awayGoals,
    homeXg: Number(homeXg.toFixed(2)),
    awayXg: Number(awayXg.toFixed(2)),
    events,
  };
}
