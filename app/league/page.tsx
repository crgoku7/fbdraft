"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
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
import { EventIcon, EventList, MiniPitch, StatRow } from "../../components/match-ui";



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



// ── Main ────────────────────────────────────────────────────────────
function LeaguePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCode = searchParams.get("room");

  const [localLeagueState, setLocalLeagueState] = useState<LeagueState | null>(null);
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'stats'>('standings');
  const [selectedTeam, setSelectedTeam] = useState<LeagueTeam | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  // Convex Queries & Mutations
  const room = useQuery(api.rooms.getRoom, roomCode ? { code: roomCode } : "skip");
  const convexLeague = useQuery(api.league.getLeague, room?._id ? { roomId: room._id } : "skip");
  const simNextRound = useMutation(api.league.simulateNextRound);
  const simRemainingRounds = useMutation(api.league.simulateRemainingRounds);

  useEffect(() => {
    setPlayerId(sessionStorage.getItem("playerId"));
  }, []);

  useEffect(() => {
    if (!roomCode) {
      // Singleplayer mode fallback
      const data = localStorage.getItem("fbdraft_league_teams");
      if (!data) { router.push("/"); return; }
      const teams: LeagueTeam[] = JSON.parse(data);
      setLocalLeagueState(createLeagueSession(teams));
    }
  }, [router, roomCode]);

  const leagueState = (roomCode ? convexLeague?.state : localLeagueState) as LeagueState | null;

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
            {(!roomCode || room?.hostId === playerId) ? (
              <>
                <button
                  onClick={async () => {
                    if (roomCode && room) {
                      await simNextRound({ roomId: room._id, hostId: playerId! });
                    } else {
                      setLocalLeagueState(simulateNextRound(leagueState));
                    }
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all hover:-translate-y-0.5 text-sm"
                >
                  ▶ Play Round {leagueState.currentRoundIndex + 1}
                </button>
                <button
                  onClick={async () => {
                    if (roomCode && room) {
                      await simRemainingRounds({ roomId: room._id, hostId: playerId! });
                    } else {
                      setLocalLeagueState(simulateRemainingRounds(leagueState));
                    }
                  }}
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition-all text-sm"
                >
                  ⏭ Simulate All
                </button>
              </>
            ) : (
              <div className="px-5 py-2.5 bg-slate-800 text-slate-400 font-bold rounded-xl text-sm flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>
                Waiting for host to simulate...
              </div>
            )}
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

export default function LeaguePage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#0a0e1a] text-white">LOADING...</div>}>
      <LeaguePageContent />
    </Suspense>
  );
}
