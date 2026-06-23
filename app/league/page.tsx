"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createLeagueSession,
  simulateNextRound,
  simulateRemainingRounds,
  type LeagueState,
  type LeagueTeam,
  type Fixture
} from "../../lib/league-engine";
import type { MatchEvent, MatchResult } from "../../lib/match-engine-v3";
import {
  buildPlayerStatsFromRounds,
  getTopScorers,
  getTopAssists,
  getMostBooked,
  getTopRated,
  getMotmLeaders,
  type PlayerStat,
} from "../../lib/player-stats";
import { getCountryFlag } from "../../lib/country-flags";
import { FORMATIONS, getPositionModifier } from "../../lib/formation-utils";
import { TeamLineupModal } from "../../components/shared-ui";

// ── Helpers ────────────────────────────────────────────────────────
function EventIcon({ type }: { type: MatchEvent["type"] }) {
  if (type === "GOAL") return <span>⚽</span>;
  if (type === "YELLOW_CARD") return <span>🟨</span>;
  if (type === "RED_CARD") return <span>🟥</span>;
  if (type === "SAVE") return <span title="Save">🧤</span>;
  return <span title="Miss">↗️</span>;
}

function EventList({ events, homeTeamId }: { events: MatchEvent[]; homeTeamId: number }) {
  if (events.length === 0) return <div className="text-slate-600 text-xs text-center py-2 italic">No events</div>;
  return (
    <div className="space-y-1 mt-2">
      {events.map((ev, i) => (
        <div key={i} className={`flex items-start text-xs ${ev.teamId === homeTeamId ? 'justify-start' : 'justify-end'}`}>
          <div className={`flex gap-2 items-start max-w-[80%] ${ev.teamId === homeTeamId ? '' : 'flex-row-reverse text-right'}`}>
            <span className="text-slate-500 font-bold w-6 tabular-nums shrink-0">{ev.minute}'</span>
            <EventIcon type={ev.type} />
            <span className="text-slate-300">
              <span className="font-bold text-white">{ev.playerName}</span>
              {ev.assistPlayerName && <span className="text-slate-500 ml-1">(ast. {ev.assistPlayerName})</span>}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mini pitch formation view ───────────────────────────────────────

const POS_COLOR: Record<string, string> = {
  GK: "bg-amber-600", DEF: "bg-blue-600", MID: "bg-emerald-600", ATT: "bg-red-600",
};
function posColor(role: string) {
  if (role === "GK") return POS_COLOR.GK;
  if (["CB","LB","RB","LWB","RWB"].includes(role)) return POS_COLOR.DEF;
  if (["CM","CDM","CAM","LM","RM"].includes(role)) return POS_COLOR.MID;
  return POS_COLOR.ATT;
}

function MiniPitch({ team, ratingsByPlayer, flipped }: { team: LeagueTeam; ratingsByPlayer: Map<number, number>; flipped?: boolean }) {
  const formation = FORMATIONS.find(f => f.id === team.formationId) || FORMATIONS[0];
  const rosterMap = new Map(team.roster.filter(r => r.slotId).map(r => [r.slotId!, r.player]));
  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border border-white/5"
      style={{
        paddingTop: "150%",
        background: "linear-gradient(180deg, #1a4a1a 0%, #163f16 50%, #1a4a1a 100%)",
        transform: flipped ? "scaleY(-1)" : undefined,
      }}
    >
      {/* Pitch lines */}
      <div className="absolute inset-[4px] border border-white/10 rounded pointer-events-none" />
      <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/10 pointer-events-none" />

      {formation.slots.map(slot => {
        const player = rosterMap.get(slot.id);
        const performanceRating = player ? ratingsByPlayer.get(player.id) : undefined;
        return (
          <div
            key={slot.id}
            className="absolute flex flex-col items-center"
            style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            {player ? (
              <>
                <div
                  className={`w-6 h-6 rounded-full ${posColor(slot.role)} flex items-center justify-center text-white font-black text-[8px] shadow-md border border-black/30`}
                  style={{ transform: flipped ? "scaleY(-1)" : undefined }}
                  title={player.name}
                >
                  {Math.floor(player.rating * getPositionModifier(player.positions, slot.role).modifier)}
                </div>
                {performanceRating !== undefined && (
                  <div
                    className="mt-px rounded bg-slate-950/80 px-1 text-[7px] font-black text-amber-300 leading-tight"
                    style={{ transform: flipped ? "scaleY(-1)" : undefined }}
                    title="Match rating"
                  >
                    {performanceRating.toFixed(1)}
                  </div>
                )}
                <div
                  className="mt-px text-[7px] font-bold text-white/80 truncate max-w-[36px] text-center leading-none"
                  style={{ transform: flipped ? "scaleY(-1)" : undefined }}
                >
                  {player.name.split(" ").slice(-1)[0]}
                </div>
              </>
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/10 border border-dashed border-white/20 flex items-center justify-center">
                <span className="text-white/30 text-[7px]">{slot.role}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FixtureCard({ fixture, teams, isRecent }: { fixture: Fixture, teams: LeagueTeam[], isRecent?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [lineupTab, setLineupTab] = useState<'events' | 'lineups'>('events');
  const home = teams.find(t => t.id === fixture.homeTeamId);
  const away = teams.find(t => t.id === fixture.awayTeamId);
  if (!home || !away) return null;
  const isUserMatch = home.isUser || away.isUser;
  const playerRatings = new Map(fixture.result?.playerRatings.map(rating => [rating.playerId, rating.rating]) ?? []);

  return (
    <div className={`rounded-xl overflow-hidden border transition-all ${isUserMatch ? 'border-indigo-500/40 bg-indigo-900/20' : 'border-white/5 bg-slate-800/40'}`}>
      <div
        onClick={() => fixture.result && setExpanded(!expanded)}
        className={`px-4 py-3 flex items-center justify-between gap-2 ${fixture.result ? 'cursor-pointer hover:bg-white/5' : ''}`}
      >
        <div className="flex-1 text-right">
          <div className={`font-bold text-sm ${home.isUser ? 'text-indigo-300' : 'text-white'}`}>{home.name}</div>
          <div className="text-[10px] text-slate-600 font-semibold">{home.formationId}</div>
        </div>
        <div className="w-20 text-center font-black text-lg shrink-0">
          {fixture.result ? (
            <span className={isUserMatch ? 'text-indigo-400' : 'text-white'}>
              {fixture.result.homeGoals} – {fixture.result.awayGoals}
            </span>
          ) : (
            <span className="text-slate-600 text-sm font-semibold">vs</span>
          )}
        </div>
        <div className="flex-1 text-left">
          <div className={`font-bold text-sm ${away.isUser ? 'text-indigo-300' : 'text-white'}`}>{away.name}</div>
          <div className="text-[10px] text-slate-600 font-semibold">{away.formationId}</div>
        </div>
        {fixture.result && (
          <span className="text-slate-500 text-xs">{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {expanded && fixture.result && (
        <div className="px-4 pb-4 border-t border-white/5 bg-slate-900/40">
          {/* xG + MOTM + tab switcher */}
          <div className="flex justify-between items-center pt-3 mb-3">
            <span className="text-[11px] text-slate-500">xG {fixture.result.homeXg}</span>
            <div className="flex gap-1 items-center">
              {fixture.result.motmName && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-lg mr-2" title="Man of the Match">
                  ⭐ {fixture.result.motmName}
                </span>
              )}
              <button
                onClick={() => setLineupTab('events')}
                className={`text-[10px] font-black px-3 py-1 rounded-lg transition-all ${lineupTab === 'events' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                EVENTS
              </button>
              <button
                onClick={() => setLineupTab('lineups')}
                className={`text-[10px] font-black px-3 py-1 rounded-lg transition-all ${lineupTab === 'lineups' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                LINEUPS
              </button>
            </div>
            <span className="text-[11px] text-slate-500 font-bold">xG {fixture.result.awayXg}</span>
          </div>

          {/* New V3 Meta Stats Row */}
          {fixture.result.meta && (
            <div className="flex justify-between items-center text-[10px] text-slate-400 mb-3 px-8">
              <div className="text-right w-12">
                <div>{fixture.result.meta.homeShots} <span className="text-[8px] text-slate-500">({fixture.result.meta.homeShotsOnTarget})</span></div>
                <div>{fixture.result.meta.homeBigChances}</div>
              </div>
              
              <div className="text-center flex-1 space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden flex flex-row-reverse">
                    <div className="h-full bg-indigo-500" style={{ width: `${fixture.result.meta.possession}%` }} />
                  </div>
                  <span className="font-black text-white w-8">{fixture.result.meta.possession}%</span>
                  <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-500" style={{ width: `${100 - fixture.result.meta.possession}%` }} />
                  </div>
                </div>
                <div className="text-[8px] uppercase tracking-widest font-bold">Shots (on target)</div>
                <div className="text-[8px] uppercase tracking-widest font-bold">Big Chances</div>
              </div>

              <div className="text-left w-12">
                <div>{fixture.result.meta.awayShots} <span className="text-[8px] text-slate-500">({fixture.result.meta.awayShotsOnTarget})</span></div>
                <div>{fixture.result.meta.awayBigChances}</div>
              </div>
            </div>
          )}

          {lineupTab === 'events' && <EventList events={fixture.result.events} homeTeamId={home.id} />}

          {lineupTab === 'lineups' && (
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 text-center">{home.name} ({home.formationId})</div>
                <MiniPitch team={home} ratingsByPlayer={playerRatings} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 text-center">{away.name} ({away.formationId})</div>
                <MiniPitch team={away} ratingsByPlayer={playerRatings} flipped />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Player stat row ─────────────────────────────────────────────────
function StatRow({ rank, stat, valueKey, valueLabel }: { rank: number, stat: PlayerStat, valueKey: keyof PlayerStat, valueLabel?: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${rank === 1 ? 'bg-amber-900/30 border border-amber-500/30' : 'bg-slate-800/40 border border-white/5'}`}>
      <div className={`w-6 text-center font-black text-sm ${rank === 1 ? 'text-amber-400' : 'text-slate-500'}`}>
        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-white truncate">{stat.playerName}</div>
        <div className="text-[11px] text-slate-500">{stat.teamName}</div>
      </div>
      <div className="text-right">
        <div className="font-black text-xl text-white">{stat[valueKey] as number}</div>
        {valueLabel && <div className="text-[10px] text-slate-500">{valueLabel}</div>}
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────
export default function LeaguePage() {
  const router = useRouter();
  const [leagueState, setLeagueState] = useState<LeagueState | null>(null);
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'stats'>('standings');
  const [selectedTeam, setSelectedTeam] = useState<LeagueTeam | null>(null);

  useEffect(() => {
    const data = localStorage.getItem("fbdraft_league_teams");
    if (!data) { router.push("/"); return; }
    const teams: LeagueTeam[] = JSON.parse(data);
    setLeagueState(createLeagueSession(teams));
  }, [router]);

  // Collect all match results from completed rounds
  const allResults = useMemo((): MatchResult[] => {
    if (!leagueState) return [];
    return leagueState.rounds
      .filter(r => r.completed)
      .flatMap(r => r.fixtures.map(f => f.result).filter(Boolean) as MatchResult[]);
  }, [leagueState]);

  const playerStats = useMemo(() => {
    if (!leagueState) return {};
    return buildPlayerStatsFromRounds(leagueState.teams, allResults);
  }, [leagueState, allResults]);

  if (!leagueState) return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center text-white font-black text-xl">
      Loading League...
    </div>
  );

  const currentRound = leagueState.currentRoundIndex < leagueState.rounds.length
    ? leagueState.rounds[leagueState.currentRoundIndex]
    : leagueState.rounds[leagueState.rounds.length - 1];

  const recentRound = leagueState.rounds.filter(r => r.completed).slice(-1)[0];
  const champion = leagueState.completed ? leagueState.standings[0] : null;

  const topScorers = getTopScorers(playerStats, 8);
  const topAssists = getTopAssists(playerStats, 8);
  const mostBooked = getMostBooked(playerStats, 8);
  const topRated = getTopRated(playerStats, 2, 8);
  const motmLeaders = getMotmLeaders(playerStats, 8);

  const TABS = [
    { id: 'standings', label: '📊 Standings' },
    { id: 'fixtures', label: '🏟️ Fixtures' },
    { id: 'stats', label: '📈 Stats' },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col">

      {/* ── Top bar ── */}
      <div className="bg-slate-900/80 border-b border-white/5 px-6 py-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight text-white">
            ⚽ League Season
          </h1>
          <p className="text-slate-500 text-sm font-semibold">
            Round {Math.min(leagueState.currentRoundIndex + (leagueState.completed ? 0 : 1), leagueState.rounds.length)} of {leagueState.rounds.length}
          </p>
        </div>

        {champion && (
          <div className="bg-amber-900/40 border border-amber-500/40 text-amber-400 px-5 py-2.5 rounded-xl font-black text-sm animate-pulse">
            🏆 {champion.name} are Champions!
          </div>
        )}

        {!leagueState.completed && (
          <div className="flex gap-2">
            <button
              onClick={() => setLeagueState(simulateNextRound(leagueState))}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all hover:-translate-y-0.5 text-sm"
            >
              ▶ Play Round {leagueState.currentRoundIndex + 1}
            </button>
            <button
              onClick={() => setLeagueState(simulateRemainingRounds(leagueState))}
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition-all text-sm"
            >
              ⏭ Simulate All
            </button>
          </div>
        )}
        {leagueState.completed && (
          <button
            onClick={() => router.push("/")}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all text-sm"
          >
            ↩ New Draft
          </button>
        )}
      </div>

      {/* ── Tab nav ── */}
      <div className="bg-slate-900/60 border-b border-white/5 px-6">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 font-bold text-sm transition-all border-b-2 -mb-px ${activeTab === tab.id
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">

        {/* ── STANDINGS TAB ── */}
        {activeTab === 'standings' && (
          <div className="rounded-2xl overflow-hidden border border-white/5 bg-slate-900/40">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-500 text-xs font-black uppercase tracking-widest">
                  <th className="p-4 w-8">#</th>
                  <th className="p-4">Club</th>
                  <th className="p-4 text-center w-10">MP</th>
                  <th className="p-4 text-center w-10">W</th>
                  <th className="p-4 text-center w-10 hidden md:table-cell">D</th>
                  <th className="p-4 text-center w-10 hidden md:table-cell">L</th>
                  <th className="p-4 text-center w-12 hidden lg:table-cell">GF</th>
                  <th className="p-4 text-center w-12 hidden lg:table-cell">GA</th>
                  <th className="p-4 text-center w-12">GD</th>
                  <th className="p-4 text-center w-12 text-white">PTS</th>
                </tr>
              </thead>
              <tbody>
                {leagueState.standings.map((s, idx) => (
                  <tr key={s.teamId} className={`border-t border-white/5 transition-colors ${s.isUser ? 'bg-indigo-900/20' : 'hover:bg-white/2'}`}>
                    <td className="p-4">
                      <span className={`text-sm font-black ${idx === 0 ? 'text-amber-400' : 'text-slate-600'}`}>{idx + 1}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-6 rounded-sm ${idx === 0 ? 'bg-amber-500' : idx <= 3 ? 'bg-indigo-500' : 'bg-slate-700'}`} />
                        <button
                          onClick={() => {
                            const team = leagueState.teams.find(t => t.id === s.teamId);
                            if (team) setSelectedTeam(team);
                          }}
                          className={`font-bold text-sm hover:underline cursor-pointer ${s.isUser ? 'text-indigo-300' : 'text-white'}`}
                        >{s.name}</button>
                        {s.isUser && <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-black">YOU</span>}
                      </div>
                    </td>
                    <td className="p-4 text-center text-slate-400 text-sm font-medium">{s.played}</td>
                    <td className="p-4 text-center font-bold text-sm">{s.wins}</td>
                    <td className="p-4 text-center text-slate-500 text-sm hidden md:table-cell">{s.draws}</td>
                    <td className="p-4 text-center text-slate-500 text-sm hidden md:table-cell">{s.losses}</td>
                    <td className="p-4 text-center text-slate-400 text-sm hidden lg:table-cell">{s.gf}</td>
                    <td className="p-4 text-center text-slate-400 text-sm hidden lg:table-cell">{s.ga}</td>
                    <td className="p-4 text-center text-sm font-medium">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                    <td className="p-4 text-center font-black text-lg text-white">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── FIXTURES TAB ── */}
        {activeTab === 'fixtures' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Upcoming */}
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
                {leagueState.completed ? 'Last Round' : `Round ${currentRound.roundNum} — Upcoming`}
              </h3>
              <div className="space-y-2">
                {currentRound.fixtures.map((f, i) => (
                  <FixtureCard key={i} fixture={f} teams={leagueState.teams} />
                ))}
              </div>
            </div>

            {/* Recent results */}
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
                Recent Results
              </h3>
              <div className="space-y-2">
                {recentRound?.fixtures.map((f, i) => (
                  <FixtureCard key={i} fixture={f} teams={leagueState.teams} isRecent />
                )) ?? <div className="text-slate-600 text-sm">No results yet.</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── STATS TAB ── */}
        {activeTab === 'stats' && (
          <div className="space-y-8">
            {/* Top row: Goals, Assists, Ratings */}
            <div className="grid md:grid-cols-3 gap-6">

              {/* Top scorers */}
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                  ⚽ Top Scorers
                </h3>
                {topScorers.length === 0 ? (
                  <div className="text-slate-600 text-sm text-center py-4">Play some rounds first!</div>
                ) : (
                  <div className="space-y-2">
                    {topScorers.map((s, i) => (
                      <StatRow key={s.playerId} rank={i + 1} stat={s} valueKey="goals" valueLabel="goals" />
                    ))}
                  </div>
                )}
              </div>

              {/* Top assists */}
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                  🎯 Top Assists
                </h3>
                {topAssists.length === 0 ? (
                  <div className="text-slate-600 text-sm text-center py-4">Play some rounds first!</div>
                ) : (
                  <div className="space-y-2">
                    {topAssists.map((s, i) => (
                      <StatRow key={s.playerId} rank={i + 1} stat={s} valueKey="assists" valueLabel="assists" />
                    ))}
                  </div>
                )}
              </div>

              {/* Top Rated */}
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                  ⭐ Top Rated
                </h3>
                {topRated.length === 0 ? (
                  <div className="text-slate-600 text-sm text-center py-4">Play some rounds first!</div>
                ) : (
                  <div className="space-y-2">
                    {topRated.map((s, i) => (
                      <div key={s.playerId} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${i === 0 ? 'bg-amber-900/30 border border-amber-500/30' : 'bg-slate-800/40 border border-white/5'}`}>
                        <div className={`w-6 text-center font-black text-sm ${i === 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-white truncate">{s.playerName}</div>
                          <div className="text-[11px] text-slate-500">{s.teamName} · {s.matchesPlayed} apps</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-xl text-white">{s.avgRating}</div>
                          <div className="text-[10px] text-slate-500">avg rating</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom row: Discipline, MOTM */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Most booked */}
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                  🟨 Discipline
                </h3>
                {mostBooked.length === 0 ? (
                  <div className="text-slate-600 text-sm text-center py-4">Play some rounds first!</div>
                ) : (
                  <div className="space-y-2">
                    {mostBooked.map((s, i) => (
                      <div key={s.playerId} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${i === 0 ? 'bg-red-900/30 border border-red-500/30' : 'bg-slate-800/40 border border-white/5'}`}>
                        <div className={`w-6 text-center font-black text-sm ${i === 0 ? 'text-red-400' : 'text-slate-500'}`}>
                          {i + 1}.
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-white truncate">{s.playerName}</div>
                          <div className="text-[11px] text-slate-500">{s.teamName}</div>
                        </div>
                        <div className="flex gap-2 text-sm">
                          {s.yellowCards > 0 && <span className="font-black text-yellow-400">🟨{s.yellowCards}</span>}
                          {s.redCards > 0 && <span className="font-black text-red-400">🟥{s.redCards}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* MOTM Leaders */}
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                  🏅 Man of the Match
                </h3>
                {motmLeaders.length === 0 ? (
                  <div className="text-slate-600 text-sm text-center py-4">Play some rounds first!</div>
                ) : (
                  <div className="space-y-2">
                    {motmLeaders.map((s, i) => (
                      <div key={s.playerId} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${i === 0 ? 'bg-amber-900/30 border border-amber-500/30' : 'bg-slate-800/40 border border-white/5'}`}>
                        <div className={`w-6 text-center font-black text-sm ${i === 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-white truncate">{s.playerName}</div>
                          <div className="text-[11px] text-slate-500">{s.teamName} · Avg {s.avgRating}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-xl text-amber-400">{s.motmCount}</div>
                          <div className="text-[10px] text-slate-500">MOTM</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {selectedTeam && <TeamLineupModal team={selectedTeam} onClose={() => setSelectedTeam(null)} />}
    </div>
  );
}
