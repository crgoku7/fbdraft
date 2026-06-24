import type { Player } from "./player-data";
import { getPositionModifier, FORMATIONS } from "./formation-utils";

// ── Types ─────────────────────────────────────────────────────────────

export type MatchEvent = {
  minute: number;
  type: "GOAL" | "YELLOW_CARD" | "RED_CARD";
  teamId: number;
  playerId: number;
  playerName: string;
  assistPlayerId?: number;
  assistPlayerName?: string;
};

export type PlayerMatchRating = {
  playerId: number;
  playerName: string;
  teamId: number;
  rating: number;
  isMotm: boolean;
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
};

export type TeamStrengthRatings = {
  attack: number;
  midfield: number;
  defense: number;
  gk: number;
  overall: number;
};

type TeamInput = {
  id: number;
  roster: { player: Player; slotId?: string }[];
  formationId: string;
};

type EffectivePlayer = Player & { effectiveRating: number; role: string };

// ── Role classification ──────────────────────────────────────────────

const ATT_ROLES = ["ST", "CF", "LW", "RW"];
const MID_ROLES = ["CAM", "CM", "CDM", "LM", "RM"];
const DEF_ROLES = ["CB", "LB", "RB", "LWB", "RWB"];

function isAttacker(role: string) { return ATT_ROLES.includes(role); }
function isMidfielder(role: string) { return MID_ROLES.includes(role); }
function isDefender(role: string) { return DEF_ROLES.includes(role); }

// ── Goal scoring role weights ────────────────────────────────────────

const GOAL_ROLE_WEIGHT: Record<string, number> = {
  ST: 1.60, CF: 1.40, LW: 1.20, RW: 1.20,
  CAM: 1.10, CM: 0.60, LM: 0.80, RM: 0.80,
  CDM: 0.30, CB: 0.15, LB: 0.10, RB: 0.10,
  LWB: 0.10, RWB: 0.10, GK: 0.01,
};

// ── Assist role weights ──────────────────────────────────────────────

const ASSIST_ROLE_WEIGHT: Record<string, number> = {
  CAM: 1.50, CM: 1.30, LW: 1.20, RW: 1.20,
  LM: 1.10, RM: 1.10, CDM: 0.80, ST: 0.50,
  CF: 0.60, LWB: 0.40, RWB: 0.40,
  CB: 0.20, LB: 0.30, RB: 0.30, GK: 0.02,
};

// ── Card role weights ────────────────────────────────────────────────

const CARD_ROLE_WEIGHT: Record<string, number> = {
  CDM: 1.50, CB: 1.40, LB: 1.20, RB: 1.20,
  LWB: 1.10, RWB: 1.10, CM: 1.00,
  CAM: 0.70, LM: 0.80, RM: 0.80,
  ST: 0.60, CF: 0.60, LW: 0.60, RW: 0.60, GK: 0.40,
};

// ── Goal timing distribution ─────────────────────────────────────────

function pickGoalMinute(): number {
  const r = Math.random();
  if (r < 0.12) return Math.floor(Math.random() * 15) + 1;
  if (r < 0.30) return Math.floor(Math.random() * 15) + 16;
  if (r < 0.50) return Math.floor(Math.random() * 15) + 31;
  if (r < 0.65) return Math.floor(Math.random() * 15) + 46;
  if (r < 0.80) return Math.floor(Math.random() * 15) + 61;
  return Math.floor(Math.random() * 18) + 76; // 76-93 (stoppage)
}

// ── Offensive trait bonuses ──────────────────────────────────────────

function getGoalTraitBonus(p: EffectivePlayer, minute: number): number {
  let bonus = 1.0;
  // Shooting traits
  if (p.traits.includes("Finesse Shot")) bonus *= 1.06;
  if (p.traits.includes("Power Shot")) bonus *= 1.05;
  if (p.traits.includes("Chip Shot")) bonus *= 1.04;
  if (p.traits.includes("Low Driven Shot")) bonus *= 1.04;
  if (p.traits.includes("Power Header")) bonus *= 1.05;
  if (p.traits.includes("Precision Header")) bonus *= 1.04;
  // Position-specific
  if (p.traits.includes("Acrobatic") && isAttacker(p.role)) bonus *= 1.04;
  if (p.traits.includes("Long Shot Taker") && isMidfielder(p.role)) bonus *= 1.06;
  // Late game
  if (minute >= 75 && p.traits.includes("Gamechanger")) bonus *= 1.10;
  if (minute >= 80 && p.traits.includes("Relentless")) bonus *= 1.05;
  if (minute >= 80 && p.traits.includes("Relentless+")) bonus *= 1.08;
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

// ── Defensive trait bonuses (NEW) ────────────────────────────────────

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

// ── GK trait bonuses (NEW) ───────────────────────────────────────────

function getGkTraitBonus(p: EffectivePlayer): number {
  let bonus = 1.0;
  if (p.traits.includes("Cross Claimer")) bonus *= 1.05;
  if (p.traits.includes("Deflector")) bonus *= 1.06;
  if (p.traits.includes("Far Reach")) bonus *= 1.05;
  if (p.traits.includes("Rush Out")) bonus *= 1.04;
  if (p.traits.includes("Footwork")) bonus *= 1.03;
  return bonus;
}

// ── Team-level xG trait bonus ────────────────────────────────────────

function getTeamTraitXgBonus(roster: EffectivePlayer[]): number {
  let bonus = 0;
  for (const p of roster) {
    if (isAttacker(p.role)) {
      if (p.traits.includes("Rapid")) bonus += 0.02;
      if (p.traits.includes("Quick Step")) bonus += 0.015;
      if (p.traits.includes("Trickster")) bonus += 0.015;
      if (p.traits.includes("First Touch")) bonus += 0.01;
    }
    if (isMidfielder(p.role)) {
      if (p.traits.includes("Playmaker")) bonus += 0.015;
      if (p.traits.includes("Incisive Pass")) bonus += 0.015;
      if (p.traits.includes("Tiki Taka")) bonus += 0.01;
    }
  }
  return Math.min(bonus, 0.18);
}

// ── Team-level defensive trait bonus (reduces opponent xG) ───────────

function getTeamDefTraitBonus(roster: EffectivePlayer[]): number {
  let bonus = 0;
  for (const p of roster) {
    if (isDefender(p.role)) {
      if (p.traits.includes("Anticipate")) bonus += 0.015;
      if (p.traits.includes("Block")) bonus += 0.015;
      if (p.traits.includes("Intercept")) bonus += 0.01;
      if (p.traits.includes("Press Proven")) bonus += 0.01;
    }
    if (p.role === "GK") {
      if (p.traits.includes("Deflector")) bonus += 0.02;
      if (p.traits.includes("Far Reach")) bonus += 0.015;
    }
  }
  return Math.min(bonus, 0.15);
}

// ── Effective roster builder ─────────────────────────────────────────

function getEffectiveRoster(team: TeamInput): EffectivePlayer[] {
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

// ── Team shape & role coverage evaluation ────────────────────────────

function evaluateTeamShape(roster: EffectivePlayer[]) {
  const attackers = roster.filter(p => isAttacker(p.role));
  const midfielders = roster.filter(p => isMidfielder(p.role));
  const defenders = roster.filter(p => isDefender(p.role));
  const gkPlayer = roster.find(p => p.role === "GK");

  // Shape penalty for missing essentials
  let shapePenalty = 1.0;
  if (!gkPlayer) shapePenalty *= 0.70;
  if (defenders.filter(p => p.role === "CB").length === 0) shapePenalty *= 0.80;
  if (midfielders.length === 0) shapePenalty *= 0.85;
  if (attackers.length === 0) shapePenalty *= 0.85;
  if (attackers.length > 5) shapePenalty *= 0.90;

  // Role coverage bonus: width, midfield balance, defensive structure
  let coverageBonus = 1.0;
  // Attacking width: having both LW/LM and RW/RM
  const hasLeftAtt = roster.some(p => ["LW", "LM"].includes(p.role));
  const hasRightAtt = roster.some(p => ["RW", "RM"].includes(p.role));
  if (hasLeftAtt && hasRightAtt) coverageBonus += 0.03;

  // Midfield structure: having at least one CDM and one creative mid
  const hasCdm = roster.some(p => p.role === "CDM");
  const hasCreative = roster.some(p => ["CAM", "CM"].includes(p.role));
  if (hasCdm && hasCreative) coverageBonus += 0.02;

  // Defensive structure: at least 2 CBs
  const cbCount = defenders.filter(p => p.role === "CB").length;
  if (cbCount >= 2) coverageBonus += 0.02;

  // Full back coverage
  const hasLeftDef = roster.some(p => ["LB", "LWB"].includes(p.role));
  const hasRightDef = roster.some(p => ["RB", "RWB"].includes(p.role));
  if (hasLeftDef && hasRightDef) coverageBonus += 0.02;

  return { shapePenalty, coverageBonus, attackers, midfielders, defenders, gkPlayer };
}

// ── Normalized strength calculation (exported for UI) ────────────────

function calculateStrengthsInternal(roster: EffectivePlayer[], formationId: string) {
  const { shapePenalty, coverageBonus, attackers, midfielders, defenders, gkPlayer } = evaluateTeamShape(roster);

  // Averages per unit
  const avgAttack = attackers.length > 0
    ? attackers.reduce((s, p) => s + p.effectiveRating, 0) / attackers.length : 50;
  const avgMidfield = midfielders.length > 0
    ? midfielders.reduce((s, p) => s + p.effectiveRating, 0) / midfielders.length : 50;

  // Defenders: include defensive trait bonuses
  const avgDefenseRaw = defenders.length > 0
    ? defenders.reduce((s, p) => s + p.effectiveRating * getDefensiveTraitBonus(p), 0) / defenders.length : 50;

  // GK: stronger influence (35% of defensive strength) + GK traits
  const gkRating = gkPlayer ? gkPlayer.effectiveRating * getGkTraitBonus(gkPlayer) : 50;
  const avgDefense = 0.65 * avgDefenseRaw + 0.35 * gkRating;

  const combined = shapePenalty * coverageBonus;

  // Formation bonuses
  let attBonus = 1.0, midBonus = 1.0, defBonus = 1.0;
  if (formationId === "4-3-3") attBonus = 1.05;
  if (formationId === "4-5-1") defBonus = 1.05;
  if (formationId === "4-2-3-1") midBonus = 1.05;
  if (formationId === "3-5-2") midBonus = 1.04;
  if (formationId === "5-3-2") defBonus = 1.06;
  if (formationId === "4-4-2") { attBonus = 1.02; defBonus = 1.02; }
  if (formationId === "3-4-3") attBonus = 1.06;
  if (formationId === "4-1-4-1") midBonus = 1.05;
  if (formationId === "3-4-2-1") { attBonus = 1.04; midBonus = 1.02; }

  return {
    attack: Math.max(avgAttack * attBonus * combined, 1),
    midfield: Math.max(avgMidfield * midBonus * combined, 1),
    defense: Math.max(avgDefense * defBonus * combined, 1),
    gk: Math.max(gkRating, 1),
  };
}

/** Public API: calculates displayable team strength ratings (0-99 scale) */
export function getTeamStrengthRatings(team: TeamInput): TeamStrengthRatings {
  const roster = getEffectiveRoster(team);
  const str = calculateStrengthsInternal(roster, team.formationId);
  return {
    attack: Math.round(str.attack),
    midfield: Math.round(str.midfield),
    defense: Math.round(str.defense),
    gk: Math.round(str.gk),
    overall: Math.round((str.attack * 0.30 + str.midfield * 0.25 + str.defense * 0.30 + str.gk * 0.15)),
  };
}

// ── Poisson ──────────────────────────────────────────────────────────

function getPoissonGoals(xg: number): number {
  const L = Math.exp(-xg);
  let p = 1.0;
  let k = 0;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

// ── Weighted picker ──────────────────────────────────────────────────

function weightedPick<T>(pool: T[], weightFn: (item: T) => number): T {
  let totalWeight = 0;
  const weights = pool.map(item => { const w = weightFn(item); totalWeight += w; return w; });
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) { rand -= weights[i]; if (rand <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

// ── Penalty shootout ─────────────────────────────────────────────────

function simulatePenaltyShootout(homeRoster: EffectivePlayer[], awayRoster: EffectivePlayer[]): { home: number; away: number } {
  const penaltyScore = (p: EffectivePlayer) => {
    let base = p.effectiveRating;
    if (isAttacker(p.role)) base *= 1.15;
    else if (isMidfielder(p.role)) base *= 1.05;
    else if (p.role === "GK") base *= 0.60;
    if (p.traits.includes("Finesse Shot")) base *= 1.05;
    if (p.traits.includes("Power Shot")) base *= 1.04;
    return base;
  };

  const homeTakers = [...homeRoster].sort((a, b) => penaltyScore(b) - penaltyScore(a)).slice(0, 5);
  const awayTakers = [...awayRoster].sort((a, b) => penaltyScore(b) - penaltyScore(a)).slice(0, 5);
  let homeScore = 0, awayScore = 0;

  const kickSuccess = (p: EffectivePlayer) => {
    const base = 0.75;
    const ratingBonus = (p.effectiveRating - 70) / 300;
    return Math.min(0.92, Math.max(0.55, base + ratingBonus));
  };

  for (let i = 0; i < 5; i++) {
    if (Math.random() < kickSuccess(homeTakers[i % homeTakers.length])) homeScore++;
    if (Math.random() < kickSuccess(awayTakers[i % awayTakers.length])) awayScore++;
    const roundsLeft = 4 - i;
    if (homeScore > awayScore + roundsLeft || awayScore > homeScore + roundsLeft) break;
  }

  let sdIdx = 5;
  while (homeScore === awayScore) {
    const hTaker = homeRoster[sdIdx % homeRoster.length];
    const aTaker = awayRoster[sdIdx % awayRoster.length];
    const hGoal = Math.random() < kickSuccess(hTaker) ? 1 : 0;
    const aGoal = Math.random() < kickSuccess(aTaker) ? 1 : 0;
    homeScore += hGoal; awayScore += aGoal;
    sdIdx++;
    if (hGoal !== aGoal) break;
    if (sdIdx > 20) break;
  }

  return { home: homeScore, away: awayScore };
}

// ── Player match rating calculator ───────────────────────────────────

function calculatePlayerRatings(
  roster: EffectivePlayer[],
  teamId: number,
  events: MatchEvent[],
  teamGoals: number,
  opponentGoals: number,
  isWinner: boolean,
  isDraw: boolean,
): PlayerMatchRating[] {
  const ratings: PlayerMatchRating[] = [];

  for (const p of roster) {
    let rating = 6.5; // base

    // Goals scored
    const goals = events.filter(e => e.type === "GOAL" && e.teamId === teamId && e.playerId === p.id).length;
    rating += goals * 1.0;

    // Assists
    const assists = events.filter(e => e.type === "GOAL" && e.teamId === teamId && e.assistPlayerId === p.id).length;
    rating += assists * 0.6;

    // Clean sheet bonus for GK and defenders
    if (opponentGoals === 0 && (p.role === "GK" || isDefender(p.role))) {
      rating += 1.0;
    }

    // GK: bonus for low goals conceded
    if (p.role === "GK" && opponentGoals <= 1 && opponentGoals > 0) {
      rating += 0.4;
    }

    // Yellow card penalty
    const yellows = events.filter(e => e.type === "YELLOW_CARD" && e.teamId === teamId && e.playerId === p.id).length;
    rating -= yellows * 0.5;

    // Red card penalty
    const reds = events.filter(e => e.type === "RED_CARD" && e.teamId === teamId && e.playerId === p.id).length;
    rating -= reds * 1.5;

    // Team result bonus/penalty
    if (isWinner) rating += 0.3;
    if (!isWinner && !isDraw) rating -= 0.2;

    // Rating quality nudge (better players slightly outperform)
    rating += (p.effectiveRating - 75) / 100;

    // Small random variance for realism
    rating += (Math.random() - 0.5) * 0.6;

    // Clamp to 4.0-10.0
    rating = Math.min(10.0, Math.max(4.0, Number(rating.toFixed(1))));

    ratings.push({
      playerId: p.id,
      playerName: p.name,
      teamId,
      rating,
      isMotm: false,
    });
  }

  return ratings;
}

// ── Main match simulation ────────────────────────────────────────────

export function simulateMatch(homeTeam: TeamInput, awayTeam: TeamInput, requiresWinner: boolean = false): MatchResult {
  const homeEff = getEffectiveRoster(homeTeam);
  const awayEff = getEffectiveRoster(awayTeam);

  const homeStr = calculateStrengthsInternal(homeEff, homeTeam.formationId);
  const awayStr = calculateStrengthsInternal(awayEff, awayTeam.formationId);

  // ── xG calculation ─────────────────────────────────────────────────
  const homeMidShare = homeStr.midfield / (homeStr.midfield + awayStr.midfield);
  const awayMidShare = 1 - homeMidShare;

  // Attack advantage ratio (clamped)
  const homeAttAdv = Math.min(homeStr.attack / awayStr.defense, 2.2);
  const awayAttAdv = Math.min(awayStr.attack / homeStr.defense, 2.2);

  // Offensive trait bonus
  const homeTraitBonus = 1 + getTeamTraitXgBonus(homeEff);
  const awayTraitBonus = 1 + getTeamTraitXgBonus(awayEff);

  // Defensive trait reduction on opponent xG
  const homeDefReduction = 1 - getTeamDefTraitBonus(homeEff);
  const awayDefReduction = 1 - getTeamDefTraitBonus(awayEff);

  // Composite xG
  const BASE_XG = 1.35;
  let homeXg = BASE_XG * homeAttAdv * (0.45 + homeMidShare * 1.1) * homeTraitBonus * awayDefReduction;
  let awayXg = BASE_XG * awayAttAdv * (0.45 + awayMidShare * 1.1) * awayTraitBonus * homeDefReduction;

  // Clamp
  homeXg = Math.min(Math.max(homeXg, 0.3), 4.5);
  awayXg = Math.min(Math.max(awayXg, 0.3), 4.5);

  const homeGoals = getPoissonGoals(homeXg);
  const awayGoals = getPoissonGoals(awayXg);

  const events: MatchEvent[] = [];

  // ── Goal events ────────────────────────────────────────────────────

  const pickScorer = (roster: EffectivePlayer[], minute: number) =>
    weightedPick(roster, p => (GOAL_ROLE_WEIGHT[p.role] ?? 0.5) * p.effectiveRating * getGoalTraitBonus(p, minute));

  const pickAssister = (roster: EffectivePlayer[], scorerId: number) => {
    const pool = roster.filter(p => p.id !== scorerId);
    if (pool.length === 0) return undefined;
    return weightedPick(pool, p => (ASSIST_ROLE_WEIGHT[p.role] ?? 0.3) * p.effectiveRating * getAssistTraitBonus(p));
  };

  for (let i = 0; i < homeGoals; i++) {
    const minute = pickGoalMinute();
    const scorer = pickScorer(homeEff, minute);
    const assister = Math.random() > 0.25 ? pickAssister(homeEff, scorer.id) : undefined;
    events.push({ minute, type: "GOAL", teamId: homeTeam.id, playerId: scorer.id, playerName: scorer.name,
      assistPlayerId: assister?.id, assistPlayerName: assister?.name });
  }
  for (let i = 0; i < awayGoals; i++) {
    const minute = pickGoalMinute();
    const scorer = pickScorer(awayEff, minute);
    const assister = Math.random() > 0.25 ? pickAssister(awayEff, scorer.id) : undefined;
    events.push({ minute, type: "GOAL", teamId: awayTeam.id, playerId: scorer.id, playerName: scorer.name,
      assistPlayerId: assister?.id, assistPlayerName: assister?.name });
  }

  // ── Yellow cards ───────────────────────────────────────────────────

  const numYellows = Math.floor(Math.random() * 4) + (Math.random() > 0.5 ? 1 : 0);
  for (let i = 0; i < numYellows; i++) {
    const teamId = Math.random() > 0.5 ? homeTeam.id : awayTeam.id;
    const roster = teamId === homeTeam.id ? homeEff : awayEff;
    const player = weightedPick(roster, p => CARD_ROLE_WEIGHT[p.role] ?? 0.6);
    events.push({ minute: Math.floor(Math.random() * 90) + 1, type: "YELLOW_CARD", teamId, playerId: player.id, playerName: player.name });
  }

  // ── Red cards (~8%) ────────────────────────────────────────────────

  if (Math.random() < 0.08) {
    const teamId = Math.random() > 0.5 ? homeTeam.id : awayTeam.id;
    const roster = teamId === homeTeam.id ? homeEff : awayEff;
    const player = weightedPick(roster, p => CARD_ROLE_WEIGHT[p.role] ?? 0.6);
    events.push({ minute: Math.floor(Math.random() * 80) + 10, type: "RED_CARD", teamId, playerId: player.id, playerName: player.name });
  }

  events.sort((a, b) => a.minute - b.minute);

  // ── Penalties ──────────────────────────────────────────────────────

  let homePenalties: number | undefined = undefined;
  let awayPenalties: number | undefined = undefined;

  if (requiresWinner && homeGoals === awayGoals) {
    const shootout = simulatePenaltyShootout(homeEff, awayEff);
    homePenalties = shootout.home;
    awayPenalties = shootout.away;
  }

  // ── Player match ratings ───────────────────────────────────────────

  const homeWin = homeGoals > awayGoals;
  const awayWin = awayGoals > homeGoals;
  const draw = homeGoals === awayGoals;

  const homeRatings = calculatePlayerRatings(homeEff, homeTeam.id, events, homeGoals, awayGoals, homeWin, draw);
  const awayRatings = calculatePlayerRatings(awayEff, awayTeam.id, events, awayGoals, homeGoals, awayWin, draw);

  const allRatings = [...homeRatings, ...awayRatings];

  // Find MOTM: highest rated player
  const motm = allRatings.reduce((best, r) => r.rating > best.rating ? r : best, allRatings[0]);
  if (motm) motm.isMotm = true;

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
  };
}
