import type { Player } from "./player-data";
import { getPositionModifier, FORMATIONS } from "./formation-utils";

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

export type TeamInput = {
  id: number;
  roster: { player: Player; slotId?: string }[];
  formationId: string;
};

export type EffectivePlayer = Player & { effectiveRating: number; role: string };

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
  CDM: 0.30, CB: 0.15, LB: 0.10, RB: 0.10, LWB: 0.10, RWB: 0.10, GK: 0.01,
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
  let gkQuality = gkPlayer ? gkPlayer.effectiveRating * getGkTraitBonus(gkPlayer) : 40;

  // 6. Discipline (Higher = worse discipline, 1.0 is neutral)
  let discipline = 1.0;
  for (const p of roster) {
    if (p.traits.includes("Bruiser")) discipline += 0.05;
    if (p.traits.includes("Slide Tackle")) discipline += 0.05;
    if (p.traits.includes("Enforcer")) discipline += 0.02;
  }

  return { buildUp, chanceCreation, finishing, defensiveResistance: defRes, gkQuality, discipline };
}

// ── V3: Match Loop ───────────────────────────────────────────────────

function weightedPick<T>(pool: T[], weightFn: (item: T) => number): T {
  let totalWeight = 0;
  const weights = pool.map(item => { const w = weightFn(item); totalWeight += w; return w; });
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) { rand -= weights[i]; if (rand <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

export function simulateMatchV3(homeTeam: TeamInput, awayTeam: TeamInput, requiresWinner: boolean = false): MatchResult {
  const homeRoster = getEffectiveRoster(homeTeam);
  const awayRoster = getEffectiveRoster(awayTeam);

  const hStr = extractV3Ratings(homeRoster);
  const aStr = extractV3Ratings(awayRoster);

  // State
  let homeGoals = 0, awayGoals = 0;
  let homeXg = 0, awayXg = 0;
  let homeShots = 0, awayShots = 0;
  let homeSOT = 0, awaySOT = 0;
  let homeBC = 0, awayBC = 0;
  let homePossTicks = 0, awayPossTicks = 0;
  
  const events: MatchEvent[] = [];
  const TOTAL_TICKS = 100;

  for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
    const minute = Math.floor((tick / TOTAL_TICKS) * 90) || 1;

    // Late game trait modifiers
    let hFin = hStr.finishing, aFin = aStr.finishing;
    let hCC = hStr.chanceCreation, aCC = aStr.chanceCreation;

    if (minute >= 75) {
      if (homeRoster.some(p => p.traits.includes("Gamechanger"))) { hFin *= 1.1; hCC *= 1.1; }
      if (awayRoster.some(p => p.traits.includes("Gamechanger"))) { aFin *= 1.1; aCC *= 1.1; }
      if (homeRoster.some(p => p.traits.includes("Relentless"))) { hStr.buildUp *= 1.05; hStr.defensiveResistance *= 1.05; }
      if (awayRoster.some(p => p.traits.includes("Relentless"))) { aStr.buildUp *= 1.05; aStr.defensiveResistance *= 1.05; }
    }

    // Score state modifiers
    let hRetain = hStr.buildUp;
    let aRetain = aStr.buildUp;
    
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
    else awayPossTicks++;

    const atk = isHomePos ? hStr : aStr;
    const atkFin = isHomePos ? hFin : aFin;
    const atkCC = isHomePos ? hCC : aCC;
    const def = isHomePos ? aStr : hStr;
    const teamId = isHomePos ? homeTeam.id : awayTeam.id;
    const roster = isHomePos ? homeRoster : awayRoster;

    // Phase 2: Advance to Final Third?
    // Baseline 45% chance to advance, modified by CC vs DefRes
    const advanceChance = 0.45 * (atkCC / def.defensiveResistance);
    if (Math.random() > advanceChance) continue; // possession dies in midfield

    // Phase 3: Create Shot?
    // Baseline 45% chance to shoot once in final third
    const shotChance = 0.45 * (atkCC / def.defensiveResistance);
    if (Math.random() > shotChance) continue; // defended or bad pass

    // We have a shot!
    if (isHomePos) homeShots++; else awayShots++;

    // Phase 4: Shot Quality & Archetype
    let shotXg = 0.05;
    const r = Math.random();
    // Big Chance (10% base, scales with CC/DefRes ratio)
    const bcThreshold = 0.10 * (atkCC / def.defensiveResistance);
    
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
    const finMult = scorer.effectiveRating / 80; // ~1.0 for average
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
        const defRoster = isHomePos ? awayRoster : homeRoster;
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

  // Cards (Simplified generation mapped across 100 ticks)
  for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
    const minute = Math.floor((tick / TOTAL_TICKS) * 90) || 1;
    
    // Yellows
    if (Math.random() < 0.035 * hStr.discipline) {
      const player = weightedPick(homeRoster, p => CARD_ROLE_WEIGHT[p.role] ?? 0.6);
      events.push({ minute, type: "YELLOW_CARD", teamId: homeTeam.id, playerId: player.id, playerName: player.name });
    }
    if (Math.random() < 0.035 * aStr.discipline) {
      const player = weightedPick(awayRoster, p => CARD_ROLE_WEIGHT[p.role] ?? 0.6);
      events.push({ minute, type: "YELLOW_CARD", teamId: awayTeam.id, playerId: player.id, playerName: player.name });
    }

    // Reds
    if (Math.random() < 0.0008 * hStr.discipline) {
      const player = weightedPick(homeRoster, p => CARD_ROLE_WEIGHT[p.role] ?? 0.6);
      events.push({ minute, type: "RED_CARD", teamId: homeTeam.id, playerId: player.id, playerName: player.name });
    }
    if (Math.random() < 0.0008 * aStr.discipline) {
      const player = weightedPick(awayRoster, p => CARD_ROLE_WEIGHT[p.role] ?? 0.6);
      events.push({ minute, type: "RED_CARD", teamId: awayTeam.id, playerId: player.id, playerName: player.name });
    }
  }

  events.sort((a, b) => a.minute - b.minute);

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
      if (p.role === "GK" && oppGoals <= 1 && oppGoals > 0) r += 0.4;
      
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
    const sd = (hRoster: EffectivePlayer[], aRoster: EffectivePlayer[]) => {
      let hScore = 0, aScore = 0;
      for (let i=0; i<5; i++) {
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
    const sdr = sd(homeRoster, awayRoster);
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
