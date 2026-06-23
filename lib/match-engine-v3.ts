import type { Player } from "./player-data";
import { getPositionModifier, FORMATIONS } from "./formation-utils";
import type { AssignedRoster } from "./league-engine";
// ── Types ─────────────────────────────────────────────────────────────

export type MatchEvent = {
  minute: number;
  type: "GOAL" | "YELLOW_CARD" | "RED_CARD" | "SAVE" | "MISS"; // Expanded
  teamId: number;
  playerId: number;
  playerName: string;
  assistPlayerId?: number;
  assistPlayerName?: string;
  xg?: number; // xG of the shot
};

export type PlayerMatchRating = {
  playerId: number;
  playerName: string;
  teamId: number;
  rating: number;
  isMotm: boolean;
};

// Extended metadata for V3
export type MatchMetadata = {
  possession: number; // 0-100 (Home team %)
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeBigChances: number;
  awayBigChances: number;
};

export type MatchResult = {
  homeTeamId: number;
  awayTeamId: number;
  homeGoals: number;
  awayGoals: number;
  homeXg: number;
  awayXg: number;
  events: MatchEvent[];
  homePenalties?: number;
  awayPenalties?: number;
  playerRatings: PlayerMatchRating[];
  motmId?: number;
  motmName?: string;
  meta: MatchMetadata; // NEW
};

export type TeamStrengthRatings = {
  attack: number;
  midfield: number;
  defense: number;
  gk: number;
  overall: number;
};

// V3 internal extracted ratings
type TeamV3Ratings = {
  buildUp: number;
  chanceCreation: number;
  finishing: number;
  defensiveResistance: number;
  gkQuality: number;
  discipline: number;
};

export type TeamV3PreviewRatings = {
  buildUp: number;
  chanceCreation: number;
  finishing: number;
  defensiveResistance: number;
  gkQuality: number;
  overall: number;
};

export type TeamInput = {
  id: number;
  roster: AssignedRoster[];
  formationId: string;
};

export type EffectivePlayer = Player & { effectiveRating: number; role: string };

type MatchState = {
  activePlayers: Map<number, Set<number>>;
  yellowCounts: Map<number, number>;
  sentOffPlayers: Set<number>;
  cardMinuteGuard: Set<string>;
};

// ── Role classification ──────────────────────────────────────────────

const ATT_ROLES = ["ST", "CF", "LW", "RW"];
const MID_ROLES = ["CAM", "CM", "CDM", "LM", "RM"];
const DEF_ROLES = ["CB", "LB", "RB", "LWB", "RWB"];

function isAttacker(role: string) { return ATT_ROLES.includes(role); }
function isMidfielder(role: string) { return MID_ROLES.includes(role); }
function isDefender(role: string) { return DEF_ROLES.includes(role); }

// ── Goal/Assist Weights (Preserved from V2) ──────────────────────────

const GOAL_ROLE_WEIGHT: Record<string, number> = {
  ST: 1.60, CF: 1.40, LW: 1.20, RW: 1.20,
  CAM: 1.10, CM: 0.60, LM: 0.80, RM: 0.80,
  CDM: 0.30, CB: 0.15, LB: 0.10, RB: 0.10, LWB: 0.15, RWB: 0.15, GK: 0.01,
};

const ASSIST_ROLE_WEIGHT: Record<string, number> = {
  CAM: 1.50, CM: 1.30, LW: 1.20, RW: 1.20,
  LM: 1.10, RM: 1.10, CDM: 0.80, ST: 0.50, CF: 0.60, LWB: 0.40, RWB: 0.40,
  CB: 0.20, LB: 0.30, RB: 0.30, GK: 0.02,
};

const CARD_ROLE_WEIGHT: Record<string, number> = {
  CDM: 1.50, CB: 1.40, LB: 1.20, RB: 1.20, LWB: 1.10, RWB: 1.10, CM: 1.00,
  CAM: 0.70, LM: 0.80, RM: 0.80, ST: 0.60, CF: 0.60, LW: 0.60, RW: 0.60, GK: 0.40,
};

// ── Trait Parsing (Preserved/Adapted from V2) ────────────────────────

function getGoalTraitBonus(p: EffectivePlayer): number {
  let bonus = 1.0;
  if (p.traits.includes("Finesse Shot")) bonus *= 1.06;
  if (p.traits.includes("Power Shot")) bonus *= 1.05;
  if (p.traits.includes("Chip Shot")) bonus *= 1.04;
  if (p.traits.includes("Low Driven Shot")) bonus *= 1.04;
  if (p.traits.includes("Power Header")) bonus *= 1.05;
  if (p.traits.includes("Precision Header")) bonus *= 1.04;
  if (p.traits.includes("Acrobatic") && isAttacker(p.role)) bonus *= 1.04;
  if (p.traits.includes("Long Shot Taker") && isMidfielder(p.role)) bonus *= 1.06;
  return bonus;
}

function getAssistTraitBonus(p: EffectivePlayer): number {
  let bonus = 1.0;
  if (p.traits.includes("Incisive Pass")) bonus *= 1.10;
  if (p.traits.includes("Playmaker")) bonus *= 1.10;
  if (p.traits.includes("Technical")) bonus *= 1.05;
  if (p.traits.includes("Pinged Pass")) bonus *= 1.05;
  if (p.traits.includes("Whipped Pass")) bonus *= 1.06;
  if (p.traits.includes("Long Ball Pass")) bonus *= 1.04;
  if (p.traits.includes("Tiki Taka")) bonus *= 1.05;
  if (p.traits.includes("Flair")) bonus *= 1.03;
  if (p.traits.includes("Inventive")) bonus *= 1.04;
  return bonus;
}

function getDefensiveTraitBonus(p: EffectivePlayer): number {
  let bonus = 1.0;
  if (p.traits.includes("Anticipate")) bonus *= 1.06;
  if (p.traits.includes("Block")) bonus *= 1.05;
  if (p.traits.includes("Intercept")) bonus *= 1.06;
  if (p.traits.includes("Bruiser")) bonus *= 1.04;
  if (p.traits.includes("Aerial Fortress")) bonus *= 1.05;
  if (p.traits.includes("Jockey")) bonus *= 1.04;
  if (p.traits.includes("Slide Tackle")) bonus *= 1.04;
  if (p.traits.includes("Enforcer")) bonus *= 1.03;
  if (p.traits.includes("Press Proven")) bonus *= 1.04;
  return bonus;
}

function getGkTraitBonus(p: EffectivePlayer): number {
  let bonus = 1.0;
  if (p.traits.includes("Cross Claimer")) bonus *= 1.05;
  if (p.traits.includes("Deflector")) bonus *= 1.06;
  if (p.traits.includes("Far Reach")) bonus *= 1.05;
  if (p.traits.includes("Rush Out")) bonus *= 1.04;
  if (p.traits.includes("Footwork")) bonus *= 1.03;
  return bonus;
}

// ── V3: Extractor ────────────────────────────────────────────────────

export function getEffectiveRoster(team: TeamInput): EffectivePlayer[] {
  const formation = FORMATIONS.find(f => f.id === team.formationId) || FORMATIONS[0];
  return team.roster
    .filter(entry => entry.slotId)
    .map(entry => {
      const slot = formation.slots.find(s => s.id === entry.slotId);
      const role = slot ? slot.role : "CM";
      const mod = getPositionModifier(entry.player.positions, role).modifier;
      return {
        ...entry.player,
        effectiveRating: entry.player.rating * mod,
        role,
      };
    });
}

function extractV3Ratings(roster: EffectivePlayer[]): TeamV3Ratings {
  const attackers = roster.filter(p => isAttacker(p.role));
  const midfielders = roster.filter(p => isMidfielder(p.role));
  const defenders = roster.filter(p => isDefender(p.role));
  const gkPlayer = roster.find(p => p.role === "GK");

  // Averages per unit
  const avgAtt = attackers.length > 0 ? attackers.reduce((s, p) => s + p.effectiveRating, 0) / attackers.length : 50;
  const avgMid = midfielders.length > 0 ? midfielders.reduce((s, p) => s + p.effectiveRating, 0) / midfielders.length : 50;
  const avgDef = defenders.length > 0 ? defenders.reduce((s, p) => s + p.effectiveRating, 0) / defenders.length : 50;

  // 1. Build-Up (Midfield control + Defender passing/Press Proven)
  let buildUp = avgMid * 0.8 + avgDef * 0.2;
  // Apply passing traits from mids/defs
  let buildUpTraitBonus = 1.0;
  for (const p of [...midfielders, ...defenders]) {
    if (p.traits.includes("Press Proven")) buildUpTraitBonus += 0.01;
    if (p.traits.includes("Pinged Pass")) buildUpTraitBonus += 0.01;
    if (p.traits.includes("Tiki Taka")) buildUpTraitBonus += 0.01;
    if (p.traits.includes("Long Ball Pass")) buildUpTraitBonus += 0.005;
  }
  buildUp *= Math.min(buildUpTraitBonus, 1.15);

  // 2. Chance Creation (Midfield vision + Attacker movement)
  let chanceCreation = avgMid * 0.7 + avgAtt * 0.3;
  let chanceTraitBonus = 1.0;
  for (const p of [...midfielders, ...attackers]) {
    if (p.traits.includes("Playmaker")) chanceTraitBonus += 0.02;
    if (p.traits.includes("Incisive Pass")) chanceTraitBonus += 0.02;
    if (p.traits.includes("Rapid")) chanceTraitBonus += 0.01;
    if (p.traits.includes("Quick Step")) chanceTraitBonus += 0.01;
    if (p.traits.includes("Whipped Pass")) chanceTraitBonus += 0.01;
  }
  chanceCreation *= Math.min(chanceTraitBonus, 1.20);

  // 3. Finishing (Attackers only, heavily modified by shooting traits)
  let finishing = avgAtt;
  let finTraitBonus = 1.0;
  for (const p of attackers) {
    finTraitBonus += (getGoalTraitBonus(p) - 1.0) / attackers.length; // distribute bonus
  }
  finishing *= finTraitBonus;

  // 4. Defensive Resistance (Defenders + CDM defending traits)
  let defRes = avgDef;
  const defensiveMids = midfielders.filter(p => p.role === "CDM");
  if (defensiveMids.length > 0) {
    const avgCdm = defensiveMids.reduce((s, p) => s + p.effectiveRating, 0) / defensiveMids.length;
    defRes = defRes * 0.8 + avgCdm * 0.2;
  }
  let defTraitBonus = 1.0;
  for (const p of [...defenders, ...defensiveMids]) {
    defTraitBonus += (getDefensiveTraitBonus(p) - 1.0) / defenders.length;
  }
  defRes *= defTraitBonus;

  // 5. GK Quality
  const gkQuality = gkPlayer ? gkPlayer.effectiveRating * getGkTraitBonus(gkPlayer) : 40;

  // 6. Discipline (Higher = worse discipline, 1.0 is neutral)
  let discipline = 1.0;
  for (const p of roster) {
    if (p.traits.includes("Bruiser")) discipline += 0.05;
    if (p.traits.includes("Slide Tackle")) discipline += 0.05;
    if (p.traits.includes("Enforcer")) discipline += 0.02;
  }

  return { buildUp, chanceCreation, finishing, defensiveResistance: defRes, gkQuality, discipline };
}

/** Display-only view of the same base attributes used by the V3 match loop. */
export function getTeamV3PreviewRatings(team: TeamInput): TeamV3PreviewRatings {
  const ratings = extractV3Ratings(getEffectiveRoster(team));
  return {
    buildUp: Math.round(ratings.buildUp),
    chanceCreation: Math.round(ratings.chanceCreation),
    finishing: Math.round(ratings.finishing),
    defensiveResistance: Math.round(ratings.defensiveResistance),
    gkQuality: Math.round(ratings.gkQuality),
    overall: Math.round(
      ratings.buildUp * 0.20
      + ratings.chanceCreation * 0.25
      + ratings.finishing * 0.25
      + ratings.defensiveResistance * 0.20
      + ratings.gkQuality * 0.10,
    ),
  };
}

// ── V3: Match Loop ───────────────────────────────────────────────────

function weightedPick<T>(pool: T[], weightFn: (item: T) => number): T {
  let totalWeight = 0;
  const weights = pool.map(item => { const w = weightFn(item); totalWeight += w; return w; });
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) { rand -= weights[i]; if (rand <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

function createMatchState(homeTeam: TeamInput, awayTeam: TeamInput): MatchState {
  return {
    activePlayers: new Map([
      [homeTeam.id, new Set(getEffectiveRoster(homeTeam).map(player => player.id))],
      [awayTeam.id, new Set(getEffectiveRoster(awayTeam).map(player => player.id))],
    ]),
    yellowCounts: new Map(),
    sentOffPlayers: new Set(),
    cardMinuteGuard: new Set(),
  };
}

function getActiveRoster(teamId: number, roster: EffectivePlayer[], state: MatchState) {
  const activeIds = state.activePlayers.get(teamId) ?? new Set<number>();
  return roster.filter(player => activeIds.has(player.id));
}

function getDismissalImpact(teamId: number, state: MatchState) {
  const activeCount = state.activePlayers.get(teamId)?.size ?? 11;
  const dismissals = Math.max(0, 11 - activeCount);
  return {
    buildUp: Math.pow(0.92, dismissals),
    chanceCreation: Math.pow(0.94, dismissals),
    defensiveResistance: Math.pow(0.88, dismissals),
  };
}

function applyCard(
  minute: number,
  teamId: number,
  roster: EffectivePlayer[],
  state: MatchState,
  events: MatchEvent[],
) {
  const activeRoster = getActiveRoster(teamId, roster, state);
  if (!activeRoster.length) return;

  const player = weightedPick(activeRoster, candidate => CARD_ROLE_WEIGHT[candidate.role] ?? 0.6);
  const guardKey = `${minute}:${player.id}`;
  if (state.cardMinuteGuard.has(guardKey) || state.sentOffPlayers.has(player.id)) return;

  state.cardMinuteGuard.add(guardKey);
  const yellowCount = state.yellowCounts.get(player.id) ?? 0;
  if (yellowCount === 1) {
    state.sentOffPlayers.add(player.id);
    state.activePlayers.get(teamId)?.delete(player.id);
    events.push({ minute, type: "RED_CARD", teamId, playerId: player.id, playerName: player.name });
    return;
  }

  state.yellowCounts.set(player.id, yellowCount + 1);
  events.push({ minute, type: "YELLOW_CARD", teamId, playerId: player.id, playerName: player.name });
}

function tryGenerateCard(
  minute: number,
  defendingTeamId: number,
  defendingRoster: EffectivePlayer[],
  defendingStrength: TeamV3Ratings,
  attackingChanceCreation: number,
  defendingGoals: number,
  attackingGoals: number,
  state: MatchState,
  events: MatchEvent[],
) {
  // Cards arise while defending. A team under sustained attacking pressure or chasing
  // the score is likelier to make a late challenge; role weights choose the offender.
  const pressure = Math.min(1.35, Math.max(0.75, attackingChanceCreation / defendingStrength.defensiveResistance));
  const scorePressure = defendingGoals < attackingGoals ? 1.18 : defendingGoals > attackingGoals ? 0.88 : 1;
  const yellowChance = 0.024 * defendingStrength.discipline * pressure * scorePressure;
  const directRedChance = 0.00045 * defendingStrength.discipline * pressure * scorePressure;

  if (Math.random() < directRedChance) {
    const activeRoster = getActiveRoster(defendingTeamId, defendingRoster, state);
    const player = activeRoster.length
      ? weightedPick(activeRoster, candidate => CARD_ROLE_WEIGHT[candidate.role] ?? 0.6)
      : undefined;
    if (player && !state.sentOffPlayers.has(player.id)) {
      const guardKey = `${minute}:${player.id}`;
      if (!state.cardMinuteGuard.has(guardKey)) {
        state.cardMinuteGuard.add(guardKey);
        state.sentOffPlayers.add(player.id);
        state.activePlayers.get(defendingTeamId)?.delete(player.id);
        events.push({ minute, type: "RED_CARD", teamId: defendingTeamId, playerId: player.id, playerName: player.name });
      }
    }
  } else if (Math.random() < yellowChance) {
    applyCard(minute, defendingTeamId, defendingRoster, state, events);
  }
}

export function validateMatchEvents(events: MatchEvent[]): string[] {
  const errors: string[] = [];
  const sentOffPlayers = new Set<number>();
  const yellowCounts = new Map<number, number>();
  const cardMinuteGuard = new Set<string>();

  for (const event of events) {
    if ((event.type as string) === "INJURY") {
      errors.push(`Injury event emitted for player ${event.playerId}.`);
    }
    if (sentOffPlayers.has(event.playerId)) {
      errors.push(`Player ${event.playerId} received an event after being sent off.`);
    }
    if (event.assistPlayerId !== undefined && sentOffPlayers.has(event.assistPlayerId)) {
      errors.push(`Sent-off player ${event.assistPlayerId} registered an assist.`);
    }

    if (event.type === "YELLOW_CARD" || event.type === "RED_CARD") {
      const guardKey = `${event.minute}:${event.playerId}`;
      if (cardMinuteGuard.has(guardKey)) errors.push(`Multiple card events for player ${event.playerId} in minute ${event.minute}.`);
      cardMinuteGuard.add(guardKey);
    }

    if (event.type === "YELLOW_CARD") {
      const count = (yellowCounts.get(event.playerId) ?? 0) + 1;
      yellowCounts.set(event.playerId, count);
      if (count > 1) errors.push(`Player ${event.playerId} received more than one yellow instead of a dismissal.`);
    }
    if (event.type === "RED_CARD") {
      if (sentOffPlayers.has(event.playerId)) errors.push(`Player ${event.playerId} received more than one red card.`);
      sentOffPlayers.add(event.playerId);
    }
  }

  return errors;
}

export function simulateMatchV3(homeTeam: TeamInput, awayTeam: TeamInput, requiresWinner: boolean = false): MatchResult {
  const homeRoster = getEffectiveRoster(homeTeam);
  const awayRoster = getEffectiveRoster(awayTeam);

  const hStr = extractV3Ratings(homeRoster);
  const aStr = extractV3Ratings(awayRoster);
  const matchState = createMatchState(homeTeam, awayTeam);

  // State
  let homeGoals = 0, awayGoals = 0;
  let homeXg = 0, awayXg = 0;
  let homeShots = 0, awayShots = 0;
  let homeSOT = 0, awaySOT = 0;
  let homeBC = 0, awayBC = 0;
  let homePossTicks = 0;

  const events: MatchEvent[] = [];
  const TOTAL_TICKS = 100;

  for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
    const minute = Math.floor((tick / TOTAL_TICKS) * 90) || 1;

    // Late game trait modifiers
    let hFin = hStr.finishing, aFin = aStr.finishing;
    let hCC = hStr.chanceCreation, aCC = aStr.chanceCreation;
    let hRetain = hStr.buildUp * getDismissalImpact(homeTeam.id, matchState).buildUp;
    let aRetain = aStr.buildUp * getDismissalImpact(awayTeam.id, matchState).buildUp;

    if (minute >= 75) {
      if (homeRoster.some(p => p.traits.includes("Gamechanger"))) { hFin *= 1.1; hCC *= 1.1; }
      if (awayRoster.some(p => p.traits.includes("Gamechanger"))) { aFin *= 1.1; aCC *= 1.1; }
      if (homeRoster.some(p => p.traits.includes("Relentless"))) { hRetain *= 1.05; }
      if (awayRoster.some(p => p.traits.includes("Relentless"))) { aRetain *= 1.05; }
    }

    // Score state modifiers
    // Team leading plays safer, trailing plays riskier
    if (homeGoals > awayGoals) {
      hRetain *= 1.1; // easier to keep ball
      hCC *= 0.8; // less attacking risk
      aRetain *= 0.9;
      aCC *= 1.2; // more desperate
    } else if (awayGoals > homeGoals) {
      aRetain *= 1.1;
      aCC *= 0.8;
      hRetain *= 0.9;
      hCC *= 1.2;
    }

    // Phase 1: Who gets the ball this tick?
    const homeBallChance = hRetain / (hRetain + aRetain);
    const isHomePos = Math.random() < homeBallChance;

    if (isHomePos) homePossTicks++;

    const atkFin = isHomePos ? hFin : aFin;
    const attackingImpact = getDismissalImpact(isHomePos ? homeTeam.id : awayTeam.id, matchState);
    const defendingImpact = getDismissalImpact(isHomePos ? awayTeam.id : homeTeam.id, matchState);
    const atkCC = (isHomePos ? hCC : aCC) * attackingImpact.chanceCreation;
    const def = isHomePos ? aStr : hStr;
    const defensiveResistance = def.defensiveResistance * defendingImpact.defensiveResistance;
    const teamId = isHomePos ? homeTeam.id : awayTeam.id;
    const roster = getActiveRoster(teamId, isHomePos ? homeRoster : awayRoster, matchState);
    const defendingTeamId = isHomePos ? awayTeam.id : homeTeam.id;
    const defendingRoster = isHomePos ? awayRoster : homeRoster;

    tryGenerateCard(
      minute,
      defendingTeamId,
      defendingRoster,
      def,
      atkCC,
      isHomePos ? awayGoals : homeGoals,
      isHomePos ? homeGoals : awayGoals,
      matchState,
      events,
    );

    // Phase 2: Advance to Final Third?
    // Baseline 45% chance to advance, modified by CC vs DefRes
    const advanceChance = Math.min(0.85, 0.45 * (atkCC / defensiveResistance));
    if (Math.random() > advanceChance) continue; // possession dies in midfield

    // Phase 3: Create Shot?
    // Baseline 45% chance to shoot once in final third
    const shotChance = Math.min(0.85, 0.45 * (atkCC / defensiveResistance));
    if (Math.random() > shotChance) continue; // defended or bad pass

    // We have a shot!
    if (isHomePos) homeShots++; else awayShots++;

    // Phase 4: Shot Quality & Archetype
    let shotXg = 0.05;
    const r = Math.random();
    // Big Chance (10% base, scales with CC/DefRes ratio)
    const bcThreshold = Math.min(0.25, 0.10 * (atkCC / defensiveResistance));

    if (r < bcThreshold) {
      shotXg = 0.35 + (Math.random() * 0.2); // Big Chance (0.35 - 0.55)
      if (isHomePos) homeBC++; else awayBC++;
    } else if (r < bcThreshold + 0.15) {
      shotXg = 0.08 + (Math.random() * 0.04); // Set Piece (0.08 - 0.12)
    } else if (r < bcThreshold + 0.50) {
      shotXg = 0.10 + (Math.random() * 0.10); // Normal Box Shot (0.10 - 0.20)
    } else {
      shotXg = 0.02 + (Math.random() * 0.04); // Long Shot (0.02 - 0.06)
    }

    if (isHomePos) homeXg += shotXg; else awayXg += shotXg;

    // Pick Scorer/Assister (Uses existing role weighting + exact traits)
    const scorer = weightedPick(roster, p => (GOAL_ROLE_WEIGHT[p.role] ?? 0.5) * p.effectiveRating * getGoalTraitBonus(p));
    const assisterPool = roster.filter(p => p.id !== scorer.id);
    const assister = Math.random() < 0.6 ? weightedPick(assisterPool, p => (ASSIST_ROLE_WEIGHT[p.role] ?? 0.3) * p.effectiveRating * getAssistTraitBonus(p)) : undefined;

    // Phase 5: Shot Execution (Goal or Save/Miss)
    // Conversion check: shotXg * Finisher multiplier vs GK multiplier
    // Base conversion rate is literally just xG. We modify it by finisher vs GK gap.
    const finMult = (scorer.effectiveRating / 80) * (atkFin / 80); // individual + team finishing quality
    const gkMult = def.gkQuality / 80;

    const goalProb = Math.min(0.95, shotXg * (finMult / gkMult));

    if (Math.random() < goalProb) {
      // GOAL!
      if (isHomePos) { homeGoals++; homeSOT++; }
      else { awayGoals++; awaySOT++; }

      events.push({
        minute, type: "GOAL", teamId, playerId: scorer.id, playerName: scorer.name,
        assistPlayerId: assister?.id, assistPlayerName: assister?.name, xg: shotXg
      });
    } else {
      // Miss or Save
      // 40% of non-goals are on target (saved)
      if (Math.random() < 0.40) {
        if (isHomePos) homeSOT++; else awaySOT++;
        // Log a save for the GK
        const defRoster = getActiveRoster(defendingTeamId, defendingRoster, matchState);
        const gk = defRoster.find(p => p.role === "GK");
        if (gk) {
          events.push({
            minute, type: "SAVE", teamId: isHomePos ? awayTeam.id : homeTeam.id,
            playerId: gk.id, playerName: gk.name, xg: shotXg
          });
        }
      } else {
        // Just a miss
        events.push({
          minute, type: "MISS", teamId, playerId: scorer.id, playerName: scorer.name, xg: shotXg
        });
      }
    }
  }

  events.sort((a, b) => a.minute - b.minute);
  const eventErrors = validateMatchEvents(events);
  if (eventErrors.length > 0) {
    throw new Error(`Invalid V3 match timeline: ${eventErrors.join(" ")}`);
  }

  // Ratings calculation
  const homeWin = homeGoals > awayGoals;
  const awayWin = awayGoals > homeGoals;
  const draw = homeGoals === awayGoals;

  function calcRatings(roster: EffectivePlayer[], tId: number, tGoals: number, oppGoals: number, isWin: boolean, isDraw: boolean) {
    return roster.map(p => {
      let r = 6.5;
      r += events.filter(e => e.type === "GOAL" && e.teamId === tId && e.playerId === p.id).length * 1.2;
      r += events.filter(e => e.type === "GOAL" && e.teamId === tId && e.assistPlayerId === p.id).length * 0.7;
      r += events.filter(e => e.type === "SAVE" && e.teamId === tId && e.playerId === p.id).length * 0.2; // new!

      // Misses are a tiny penalty
      r -= events.filter(e => e.type === "MISS" && e.teamId === tId && e.playerId === p.id).length * 0.1;

      if (oppGoals === 0 && (p.role === "GK" || isDefender(p.role))) r += 1.0;
      if (p.role === "GK" && oppGoals === 1 && homeWin) r += 0.4;
      if (p.role === "GK") { r -= oppGoals * 0.5; }

      r -= events.filter(e => e.type === "YELLOW_CARD" && e.teamId === tId && e.playerId === p.id).length * 0.5;
      r -= events.filter(e => e.type === "RED_CARD" && e.teamId === tId && e.playerId === p.id).length * 1.5;

      if (isWin) r += 0.3;
      if (!isWin && !isDraw) r -= 0.2;
      r += (p.effectiveRating - 75) / 100;
      r += (Math.random() - 0.5) * 0.4;

      return { playerId: p.id, playerName: p.name, teamId: tId, rating: Math.min(10.0, Math.max(4.0, Number(r.toFixed(1)))), isMotm: false };
    });
  }

  const hRatings = calcRatings(homeRoster, homeTeam.id, homeGoals, awayGoals, homeWin, draw);
  const aRatings = calcRatings(awayRoster, awayTeam.id, awayGoals, homeGoals, awayWin, draw);
  const allRatings = [...hRatings, ...aRatings];

  const motm = allRatings.reduce((best, r) => r.rating > best.rating ? r : best, allRatings[0]);
  if (motm) motm.isMotm = true;

  // Penalties if needed
  let homePenalties, awayPenalties;
  if (requiresWinner && homeGoals === awayGoals) {
    const sd = () => {
      let hScore = 0, aScore = 0;
      for (let i = 0; i < 5; i++) {
        if (Math.random() < 0.75) hScore++;
        if (Math.random() < 0.75) aScore++;
        const left = 4 - i;
        if (hScore > aScore + left || aScore > hScore + left) break;
      }
      while (hScore === aScore) {
        if (Math.random() < 0.75) hScore++;
        if (Math.random() < 0.75) aScore++;
      }
      return { home: hScore, away: aScore };
    };
    const sdr = sd();
    homePenalties = sdr.home; awayPenalties = sdr.away;
  }

  return {
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeGoals,
    awayGoals,
    homeXg: Number(homeXg.toFixed(2)),
    awayXg: Number(awayXg.toFixed(2)),
    events,
    homePenalties,
    awayPenalties,
    playerRatings: allRatings,
    motmId: motm?.playerId,
    motmName: motm?.playerName,
    meta: {
      possession: Math.round((homePossTicks / TOTAL_TICKS) * 100),
      homeShots,
      awayShots,
      homeShotsOnTarget: homeSOT,
      awayShotsOnTarget: awaySOT,
      homeBigChances: homeBC,
      awayBigChances: awayBC,
    }
  };
}
