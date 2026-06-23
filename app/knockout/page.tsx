"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { LeagueTeam } from "../../lib/league-engine";
import { createKnockoutSession, simulateKnockoutRound, type KnockoutState, type KnockoutMatch } from "../../lib/knockout-engine";
import { TeamLineupModal } from "../../components/shared-ui";
import { StatRow, MatchDetailsModal } from "../../components/match-ui";
import {
  buildPlayerStatsFromRounds,
  getTopScorers,
  getTopAssists,
  getMostBooked,
  getTopRated,
  getMotmLeaders,
} from "../../lib/player-stats";
import type { MatchResult } from "../../lib/match-engine-v3";

export default function KnockoutPage() {
  const router = useRouter();
  const [state, setState] = useState<KnockoutState | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<LeagueTeam | null>(null);
  const [activeTab, setActiveTab] = useState<'bracket' | 'stats'>('bracket');
  const [selectedMatch, setSelectedMatch] = useState<KnockoutMatch | null>(null);

  useEffect(() => {
    const data = localStorage.getItem("fbdraft_league_teams");
    if (!data) {
      router.push("/");
      return;
    }
    const teams: LeagueTeam[] = JSON.parse(data);
    setState(createKnockoutSession(teams));
  }, [router]);

  const allResults = useMemo((): MatchResult[] => {
    if (!state) return [];
    return state.rounds
      .filter(r => r.completed)
      .flatMap(r => r.matches.map(m => m.result).filter(Boolean) as MatchResult[]);
  }, [state]);

  const playerStats = useMemo(() => {
    if (!state) return {};
    return buildPlayerStatsFromRounds(state.teams, allResults);
  }, [state, allResults]);

  if (!state) return null;

  const handleSimulateNextRound = () => {
    setState(prev => prev ? simulateKnockoutRound(prev) : prev);
  };

  const handleSimulateAll = () => {
    setState(prev => {
      let s = prev;
      while (s && !s.completed) {
        s = simulateKnockoutRound(s);
      }
      return s ? { ...s } : prev;
    });
  };

  const getTeamName = (id: number | null) => {
    if (id === null) return "TBD";
    const t = state.teams.find(t => t.id === id);
    return t ? t.name : "TBD";
  };

  const handleTeamClick = (id: number | null) => {
    if (id === null) return;
    const team = state.teams.find(t => t.id === id);
    if (team) setSelectedTeam(team);
  };

  const champion = state.championId !== undefined ? state.teams.find(t => t.id === state.championId) : null;



  const topScorers = getTopScorers(playerStats, 8);
  const topAssists = getTopAssists(playerStats, 8);
  const mostBooked = getMostBooked(playerStats, 8);
  const topRated = getTopRated(playerStats, 2, 8);
  const motmLeaders = getMotmLeaders(playerStats, 8);

  const TABS = [
    { id: 'bracket', label: '🏆 Bracket' },
    { id: 'stats', label: '📈 Stats' },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200 flex flex-col font-sans">
      <header className="h-20 border-b border-white/5 bg-slate-900/50 flex items-center justify-between px-8 shrink-0">
        <div>
          <h1 className="font-black text-2xl tracking-tight text-white flex gap-2 items-center">
            <span className="text-indigo-500">KNOCKOUT</span> TOURNAMENT
          </h1>
          <p className="text-slate-400 text-sm font-semibold">Single Elimination Bracket</p>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={handleSimulateNextRound}
            disabled={state.completed}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-white/10 transition-colors disabled:opacity-50"
          >
            Simulate Next Round
          </button>
          <button 
            onClick={handleSimulateAll}
            disabled={state.completed}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-colors disabled:opacity-50"
          >
            Simulate All
          </button>
          {state.completed && (
            <button
              onClick={() => router.push("/")}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors"
            >
              ↩ New Draft
            </button>
          )}
        </div>
      </header>

      {/* ── Tab nav ── */}
      <div className="bg-slate-900/60 border-b border-white/5 px-8 shrink-0">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-3.5 font-bold text-sm transition-all border-b-2 -mb-px ${activeTab === tab.id
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 p-8 overflow-x-auto relative">
        {activeTab === 'bracket' && (
          <>
            {champion && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center animate-swivel-in z-10">
            <div className="inline-block bg-gradient-to-r from-amber-500 to-yellow-400 p-[2px] rounded-2xl shadow-2xl shadow-amber-500/20">
              <div className="bg-slate-900 px-8 py-4 rounded-[14px]">
                <div className="text-4xl mb-2">🏆</div>
                <div className="text-sm font-bold text-amber-500 tracking-widest uppercase mb-1">Champions</div>
                <div className="text-3xl font-black text-white">{champion.name}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-16 min-w-max h-full items-center pt-24 pb-8 px-8">
          {state.rounds.map((round, rIdx) => (
            <div key={rIdx} className="flex flex-col gap-6 justify-center relative">
              <h3 className="absolute -top-12 left-0 right-0 text-lg font-black tracking-widest text-center text-slate-500 uppercase">{round.name}</h3>
              {round.matches.map(m => {
                const homeWinner = m.result && m.result.homeGoals + (m.result.homePenalties || 0) > m.result.awayGoals + (m.result.awayPenalties || 0);
                const awayWinner = m.result && m.result.awayGoals + (m.result.awayPenalties || 0) > m.result.homeGoals + (m.result.homePenalties || 0);
                
                return (
                  <div key={m.id} className={`bg-slate-900 border ${m.result ? "border-slate-700" : "border-indigo-500/30"} rounded-xl p-4 w-64 shadow-xl relative`}>
                    {m.result && (
                      <button
                        onClick={() => setSelectedMatch(m)}
                        className="absolute -right-3 -top-3 w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-500 transition-all shadow-lg z-20"
                        title="Match Details"
                      >
                        ℹ️
                      </button>
                    )}
                    <div className={`flex justify-between items-center mb-3 ${homeWinner ? "text-white" : m.result ? "text-slate-500" : "text-slate-300"}`}>
                      <button
                        onClick={() => handleTeamClick(m.homeTeamId)}
                        className={`font-bold truncate max-w-[150px] hover:underline cursor-pointer ${m.homeTeamId === null ? 'cursor-default' : ''}`}
                        disabled={m.homeTeamId === null}
                      >
                        {getTeamName(m.homeTeamId)}
                      </button>
                      {m.result && (
                        <div className="flex items-center gap-2">
                          {m.result.homePenalties !== undefined && <span className="text-xs text-slate-500">({m.result.homePenalties})</span>}
                          <span className={`font-black text-lg ${homeWinner ? "text-emerald-400" : ""}`}>{m.result.homeGoals}</span>
                        </div>
                      )}
                    </div>
                    <div className="h-px bg-white/5 w-full mb-3" />
                    <div className={`flex justify-between items-center ${awayWinner ? "text-white" : m.result ? "text-slate-500" : "text-slate-300"}`}>
                      {m.isBye ? (
                        <span className="text-slate-600 italic font-bold">BYE</span>
                      ) : (
                        <button
                          onClick={() => handleTeamClick(m.awayTeamId)}
                          className={`font-bold truncate max-w-[150px] hover:underline cursor-pointer ${m.awayTeamId === null ? 'cursor-default' : ''}`}
                          disabled={m.awayTeamId === null}
                        >
                          {getTeamName(m.awayTeamId)}
                        </button>
                      )}
                      {m.result && !m.isBye && (
                        <div className="flex items-center gap-2">
                          {m.result.awayPenalties !== undefined && <span className="text-xs text-slate-500">({m.result.awayPenalties})</span>}
                          <span className={`font-black text-lg ${awayWinner ? "text-emerald-400" : ""}`}>{m.result.awayGoals}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
          </>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-8 max-w-5xl mx-auto w-full">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">⚽ Top Scorers</h3>
                {topScorers.length === 0 ? <div className="text-slate-600 text-sm text-center py-4">Play some rounds first!</div> : (
                  <div className="space-y-2">{topScorers.map((s, i) => <StatRow key={s.playerId} rank={i + 1} stat={s} valueKey="goals" valueLabel="goals" />)}</div>
                )}
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">🎯 Top Assists</h3>
                {topAssists.length === 0 ? <div className="text-slate-600 text-sm text-center py-4">Play some rounds first!</div> : (
                  <div className="space-y-2">{topAssists.map((s, i) => <StatRow key={s.playerId} rank={i + 1} stat={s} valueKey="assists" valueLabel="assists" />)}</div>
                )}
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">⭐ Top Rated</h3>
                {topRated.length === 0 ? <div className="text-slate-600 text-sm text-center py-4">Play some rounds first!</div> : (
                  <div className="space-y-2">
                    {topRated.map((s, i) => (
                      <div key={s.playerId} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${i === 0 ? 'bg-amber-900/30 border border-amber-500/30' : 'bg-slate-800/40 border border-white/5'}`}>
                        <div className={`w-6 text-center font-black text-sm ${i === 0 ? 'text-amber-400' : 'text-slate-500'}`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</div>
                        <div className="flex-1 min-w-0"><div className="font-bold text-sm text-white truncate">{s.playerName}</div><div className="text-[11px] text-slate-500">{s.teamName} · {s.matchesPlayed} apps</div></div>
                        <div className="text-right"><div className="font-black text-xl text-white">{s.avgRating}</div><div className="text-[10px] text-slate-500">avg rating</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">🟨 Discipline</h3>
                {mostBooked.length === 0 ? <div className="text-slate-600 text-sm text-center py-4">Play some rounds first!</div> : (
                  <div className="space-y-2">
                    {mostBooked.map((s, i) => (
                      <div key={s.playerId} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${i === 0 ? 'bg-red-900/30 border border-red-500/30' : 'bg-slate-800/40 border border-white/5'}`}>
                        <div className={`w-6 text-center font-black text-sm ${i === 0 ? 'text-red-400' : 'text-slate-500'}`}>{i + 1}.</div>
                        <div className="flex-1 min-w-0"><div className="font-bold text-sm text-white truncate">{s.playerName}</div><div className="text-[11px] text-slate-500">{s.teamName}</div></div>
                        <div className="flex gap-2 text-sm">{s.yellowCards > 0 && <span className="font-black text-yellow-400">🟨{s.yellowCards}</span>}{s.redCards > 0 && <span className="font-black text-red-400">🟥{s.redCards}</span>}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">🏅 Man of the Match</h3>
                {motmLeaders.length === 0 ? <div className="text-slate-600 text-sm text-center py-4">Play some rounds first!</div> : (
                  <div className="space-y-2">
                    {motmLeaders.map((s, i) => (
                      <div key={s.playerId} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${i === 0 ? 'bg-amber-900/30 border border-amber-500/30' : 'bg-slate-800/40 border border-white/5'}`}>
                        <div className={`w-6 text-center font-black text-sm ${i === 0 ? 'text-amber-400' : 'text-slate-500'}`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</div>
                        <div className="flex-1 min-w-0"><div className="font-bold text-sm text-white truncate">{s.playerName}</div><div className="text-[11px] text-slate-500">{s.teamName} · Avg {s.avgRating}</div></div>
                        <div className="text-right"><div className="font-black text-xl text-amber-400">{s.motmCount}</div><div className="text-[10px] text-slate-500">MOTM</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedTeam && <TeamLineupModal team={selectedTeam} onClose={() => setSelectedTeam(null)} />}
      
      {selectedMatch && selectedMatch.result && selectedMatch.homeTeamId !== null && selectedMatch.awayTeamId !== null && (
        <MatchDetailsModal
          result={selectedMatch.result}
          homeTeam={state.teams.find(t => t.id === selectedMatch.homeTeamId)!}
          awayTeam={state.teams.find(t => t.id === selectedMatch.awayTeamId)!}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}
