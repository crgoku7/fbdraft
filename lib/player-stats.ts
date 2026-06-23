import type { MatchResult, PlayerMatchRating } from "./match-engine-v3";
import type { LeagueTeam } from "./league-engine";

export type PlayerStat = {
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  matchesPlayed: number;
  // New: match rating system
  totalRating: number;      // sum of all match ratings
  avgRating: number;         // totalRating / matchesPlayed
  highestRating: number;     // best single match
  motmCount: number;         // Man of the Match awards
  cleanSheets: number;       // for GK/defenders
};

export type PlayerStatsMap = Record<number, PlayerStat>;

export function buildPlayerStatsFromRounds(
  teams: LeagueTeam[],
  allResults: MatchResult[]
): PlayerStatsMap {
  const stats: PlayerStatsMap = {};

  // Initialize stats for every player in every team
  for (const team of teams) {
    for (const rosterEntry of team.roster) {
      const p = rosterEntry.player;
      stats[p.id] = {
        playerId: p.id,
        playerName: p.name,
        teamId: team.id,
        teamName: team.name,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        matchesPlayed: 0,
        totalRating: 0,
        avgRating: 0,
        highestRating: 0,
        motmCount: 0,
        cleanSheets: 0,
      };
    }
  }

  // Track which matches each player participated in
  const matchesPlayedSet: Record<number, Set<string>> = {};

  for (const result of allResults) {
    const matchKey = `${result.homeTeamId}-${result.awayTeamId}-${result.homeGoals}-${result.awayGoals}`;

    // Mark all players on both teams as having played
    const homeTeam = teams.find(t => t.id === result.homeTeamId);
    const awayTeam = teams.find(t => t.id === result.awayTeamId);

    for (const team of [homeTeam, awayTeam]) {
      if (!team) continue;
      const isHome = team.id === result.homeTeamId;
      const conceded = isHome ? result.awayGoals : result.homeGoals;

      for (const entry of team.roster) {
        const id = entry.player.id;
        if (!matchesPlayedSet[id]) matchesPlayedSet[id] = new Set();
        if (!matchesPlayedSet[id].has(matchKey)) {
          matchesPlayedSet[id].add(matchKey);
          if (stats[id]) {
            stats[id].matchesPlayed++;
            // Clean sheet tracking
            if (conceded === 0) {
              stats[id].cleanSheets++;
            }
          }
        }
      }
    }

    // Process events
    for (const event of result.events) {
      const s = stats[event.playerId];
      if (!s) continue;

      if (event.type === "GOAL") {
        s.goals++;
        if (event.assistPlayerId && stats[event.assistPlayerId]) {
          stats[event.assistPlayerId].assists++;
        }
      } else if (event.type === "YELLOW_CARD") {
        s.yellowCards++;
      } else if (event.type === "RED_CARD") {
        s.redCards++;
      }
    }

    // Process player match ratings
    if (result.playerRatings) {
      for (const pr of result.playerRatings) {
        const s = stats[pr.playerId];
        if (!s) continue;
        s.totalRating += pr.rating;
        if (pr.rating > s.highestRating) s.highestRating = pr.rating;
        if (pr.isMotm) s.motmCount++;
      }
    }
  }

  // Calculate average ratings
  for (const s of Object.values(stats)) {
    s.avgRating = s.matchesPlayed > 0 ? Number((s.totalRating / s.matchesPlayed).toFixed(2)) : 0;
  }

  return stats;
}

// ── Leaderboard helpers ──────────────────────────────────────────────

export function getTopScorers(stats: PlayerStatsMap, limit = 10): PlayerStat[] {
  return Object.values(stats)
    .filter(s => s.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, limit);
}

export function getTopAssists(stats: PlayerStatsMap, limit = 10): PlayerStat[] {
  return Object.values(stats)
    .filter(s => s.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
    .slice(0, limit);
}

export function getMostBooked(stats: PlayerStatsMap, limit = 10): PlayerStat[] {
  return Object.values(stats)
    .filter(s => s.yellowCards > 0 || s.redCards > 0)
    .sort((a, b) => (b.yellowCards + b.redCards * 2) - (a.yellowCards + a.redCards * 2))
    .slice(0, limit);
}

export function getTopRated(stats: PlayerStatsMap, minMatches = 2, limit = 10): PlayerStat[] {
  return Object.values(stats)
    .filter(s => s.matchesPlayed >= minMatches)
    .sort((a, b) => b.avgRating - a.avgRating || b.goals - a.goals)
    .slice(0, limit);
}

export function getMotmLeaders(stats: PlayerStatsMap, limit = 10): PlayerStat[] {
  return Object.values(stats)
    .filter(s => s.motmCount > 0)
    .sort((a, b) => b.motmCount - a.motmCount || b.avgRating - a.avgRating)
    .slice(0, limit);
}

/** Team of the Tournament: best avg-rated player per position group */
export function getTeamOfTournament(stats: PlayerStatsMap, teams: LeagueTeam[]): PlayerStat[] {
  // Build position map: playerId → primary position
  const posMap: Record<number, string> = {};
  for (const team of teams) {
    for (const entry of team.roster) {
      posMap[entry.player.id] = entry.player.positions[0] || "CM";
    }
  }

  const eligible = Object.values(stats).filter(s => s.matchesPlayed >= 2);

  const gks = eligible.filter(s => posMap[s.playerId] === "GK").sort((a, b) => b.avgRating - a.avgRating);
  const defs = eligible.filter(s => ["CB", "LB", "RB", "LWB", "RWB"].includes(posMap[s.playerId])).sort((a, b) => b.avgRating - a.avgRating);
  const mids = eligible.filter(s => ["CM", "CAM", "CDM", "LM", "RM"].includes(posMap[s.playerId])).sort((a, b) => b.avgRating - a.avgRating);
  const atts = eligible.filter(s => ["ST", "CF", "LW", "RW"].includes(posMap[s.playerId])).sort((a, b) => b.avgRating - a.avgRating);

  return [
    ...gks.slice(0, 1),
    ...defs.slice(0, 4),
    ...mids.slice(0, 3),
    ...atts.slice(0, 3),
  ];
}
