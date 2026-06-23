"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LeagueTeam } from "../../lib/league-engine";
import { createKnockoutSession, simulateKnockoutRound, type KnockoutState } from "../../lib/knockout-engine";
import { TeamLineupModal } from "../../components/shared-ui";

export default function KnockoutPage() {
  const router = useRouter();
  const [state, setState] = useState<KnockoutState | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<LeagueTeam | null>(null);

  useEffect(() => {
    const data = localStorage.getItem("fbdraft_league_teams");
    if (!data) {
      router.push("/");
      return;
    }
    const teams: LeagueTeam[] = JSON.parse(data);
    setState(createKnockoutSession(teams));
  }, [router]);

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

      <main className="flex-1 p-8 overflow-x-auto relative">
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
      </main>

      {selectedTeam && <TeamLineupModal team={selectedTeam} onClose={() => setSelectedTeam(null)} />}
    </div>
  );
}
