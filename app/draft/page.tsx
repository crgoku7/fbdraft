"use client";

import { useState, useEffect, useRef } from "react";
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { 
  createAuctionSession, 
  placeBid, 
  concludeAuctionForCurrentPlayer, 
  getAIBidDecision,
  autoCompleteAuction,
  type AuctionState,
  type AuctionTeam,
  type AuctionConfig
} from "../../lib/auction-engine";
import { loadPlayers, type Player } from "../../lib/player-data";
import { FORMATIONS, getPositionModifier, type PositionModifierResult } from "../../lib/formation-utils";
import { useRouter } from "next/navigation";
import { optimizeTeamFormation } from "../../lib/ai-formation";
import { AuctionCard, DraggablePlayer, PitchSlot, BenchArea } from "../../components/draft-ui";
import { GameSettingsForm, type GameSettings, DEFAULT_SETTINGS } from "../../components/shared-ui";
import { getCountryFlag } from "../../lib/country-flags";
import { getTeamStrengthRatings } from "../../lib/match-engine";

// ── Draft history item ──────────────────────────────────────────────
type HistoryEntry = { player: Player; teamName: string; price: number };

// ── Main Page ──────────────────────────────────────────────────────
export default function DraftPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftState, setDraftState] = useState<AuctionState | null>(null);
  const [phase, setPhase] = useState<'countdown' | 'bidding' | 'sold'>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(7);
  const [formationId, setFormationId] = useState(FORMATIONS[0].id);
  const [draftHistory, setDraftHistory] = useState<HistoryEntry[]>([]);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const previousRosterLength = useRef(0);

  // Smart auto-assign: preferred pos → any empty slot
  useEffect(() => {
    if (!draftState) return;
    const myTeam = draftState.teams.find(t => t.id === draftState.teams[0].id);
    if (!myTeam) return;

    if (myTeam.roster.length > previousRosterLength.current) {
      const newlyAddedCount = myTeam.roster.length - previousRosterLength.current;
      const newlyAdded = myTeam.roster.slice(-newlyAddedCount);
      const formation = FORMATIONS.find(f => f.id === formationId) || FORMATIONS[0];

      setDraftState(prev => {
        if (!prev) return prev;
        const nt = [...prev.teams];
        const mi = nt.findIndex(t => t.id === myTeam.id);
        if (mi === -1) return prev;
        const mr = [...nt[mi].roster];
        let changed = false;
        const usedSlots = new Set(mr.map(x => x.slotId).filter(Boolean));

        newlyAdded.forEach(newEntry => {
          const rIdx = mr.findIndex(x => x.player.id === newEntry.player.id);
          if (rIdx !== -1 && !mr[rIdx].slotId) {
            let chosenSlot = formation.slots.find(s => !usedSlots.has(s.id) && newEntry.player.positions.includes(s.role));
            if (!chosenSlot) chosenSlot = formation.slots.find(s => !usedSlots.has(s.id));
            if (chosenSlot) {
              mr[rIdx].slotId = chosenSlot.id;
              usedSlots.add(chosenSlot.id);
              changed = true;
            }
          }
        });

        if (changed) {
          nt[mi] = { ...nt[mi], roster: mr };
          return { ...prev, teams: nt };
        }
        return prev;
      });
    }
    previousRosterLength.current = myTeam.roster.length;
  }, [draftState?.teams, formationId]);

  useEffect(() => { setPlayers(loadPlayers()); }, []);

  const handleStartDraft = () => {
    if (players.length === 0) return;
    const auctionConfig: AuctionConfig = {
      aiCount: settings.aiCount,
      teamSize: settings.teamSize,
      budget: settings.budget,
      tournamentType: settings.tournamentType,
    };
    setDraftState(createAuctionSession(players, auctionConfig));
    setPhase('countdown');
    setCountdown(3);
    setTimer(7);
    setDraftHistory([]);
    previousRosterLength.current = 0;
  };

  const handleSimulateMatch = () => {
    if (!draftState || !draftState.completed) return;
    const leagueTeams = draftState.teams.map(team => {
      if (team.isUser) {
        return { id: team.id, name: team.name, isUser: team.isUser, roster: team.roster, formationId };
      } else {
        const optimized = optimizeTeamFormation(team.roster.map(r => r.player));
        return { id: team.id, name: team.name, isUser: team.isUser, roster: optimized.roster, formationId: optimized.formationId };
      }
    });
    localStorage.setItem("fbdraft_league_teams", JSON.stringify(leagueTeams));
    if (settings.tournamentType === "KNOCKOUT") {
      router.push("/knockout");
    } else {
      router.push("/league");
    }
  };

  const handleBid = (amount: number) => {
    if (!draftState) return;
    const myTeam = draftState.teams[0];
    setDraftState(prev => prev ? placeBid(prev, myTeam.id, amount) : prev);
    setTimer(7);
  };

  const handleWithdraw = () => {
    if (!draftState || !draftState.currentPlayerOnAuction) return;
    // snapshot before simulation
    const playerBeingAuctioned = draftState.currentPlayerOnAuction;
    // run AI to conclusion — conclude assigns the player and advances
    const afterAI = autoCompleteAuction(draftState);
    // The winner of this round was the highestBidder *before* conclude advanced the state
    // autoCompleteAuction calls concludeAuctionForCurrentPlayer internally, which deducts budget
    // We need to find which team gained a player vs draftState
    const previousRoster = new Map(draftState.teams.map(t => [t.id, t.roster.length]));
    const winningTeam = afterAI.teams.find(t => (t.roster.length > (previousRoster.get(t.id) ?? 0)) && t.roster.some(r => r.player.id === playerBeingAuctioned.id));
    const finalPrice = afterAI.teams.find(t => winningTeam && t.id === winningTeam.id)
      ? draftState.teams.find(t => winningTeam && t.id === winningTeam.id)!.budget - afterAI.teams.find(t => winningTeam && t.id === winningTeam.id)!.budget
      : draftState.currentBid;
    setDraftHistory(prev => [{
      player: playerBeingAuctioned,
      teamName: winningTeam?.name ?? "No bid",
      price: finalPrice,
    }, ...prev].slice(0, 12));
    setDraftState(afterAI);
    setPhase('countdown');
    setCountdown(3);
    setTimer(7);
  };

  // Countdown → bidding
  useEffect(() => {
    if (!draftState || draftState.completed || phase !== 'countdown') return;
    if (countdown <= 0) { setPhase('bidding'); setTimer(7); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, draftState]);

  // Bidding timer
  useEffect(() => {
    if (!draftState || draftState.completed || phase !== 'bidding') return;
    if (timer <= 0) {
      setPhase('sold');
      setTimeout(() => {
        const current = draftState;
        if (current.currentPlayerOnAuction) {
          const winnerTeam = current.teams.find(t => t.id === current.highestBidderId);
          setDraftHistory(prev => [{
            player: current.currentPlayerOnAuction!,
            teamName: winnerTeam?.name ?? "No bid",
            price: current.currentBid,
          }, ...prev].slice(0, 12));
        }
        setDraftState(prev => prev ? concludeAuctionForCurrentPlayer(prev) : prev);
        setPhase('countdown');
        setCountdown(3);
      }, 2000);
    } else {
      const t = setTimeout(() => setTimer(s => s - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [phase, timer, draftState]);

  // AI bidding
  useEffect(() => {
    if (!draftState || draftState.completed || phase !== 'bidding') return;
    const interval = setInterval(() => {
      if (timer <= 0) return;
      if (Math.random() > 0.6) {
        const decision = getAIBidDecision(draftState);
        if (decision) {
          setDraftState(prev => prev ? placeBid(prev, decision.teamId, decision.bidIncrease) : prev);
          setTimer(7);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [draftState, timer, phase]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !draftState) return;
    const playerId = parseInt(String(active.id).split('-')[1]);
    const overId = String(over.id);
    const slotId = overId === "bench" ? undefined : overId;

    setDraftState(prev => {
      if (!prev) return prev;
      const nt = [...prev.teams];
      const mi = nt.findIndex(t => t.id === prev.teams[0].id);
      if (mi === -1) return prev;
      const mr = [...nt[mi].roster];
      const playerIdx = mr.findIndex(r => r.player.id === playerId);
      if (playerIdx === -1) return prev;
      const occupiedIdx = slotId ? mr.findIndex(r => r.slotId === slotId) : -1;
      if (occupiedIdx !== -1) {
        const tempSlot = mr[playerIdx].slotId;
        mr[playerIdx].slotId = slotId;
        mr[occupiedIdx].slotId = tempSlot;
      } else {
        mr[playerIdx].slotId = slotId;
      }
      nt[mi] = { ...nt[mi], roster: mr };
      return { ...prev, teams: nt };
    });
  };

  // ── Start screen ──────────────────────────────────────────────────
  if (!draftState) {
    return (
      <GameSettingsForm
        settings={settings}
        onChange={setSettings}
        onStart={handleStartDraft}
        disabled={players.length === 0}
        title="Auction Settings"
        accent="indigo"
      />
    );
  }

  const formation = FORMATIONS.find(f => f.id === formationId) || FORMATIONS[0];
  const myTeam = draftState.teams.find(t => t.id === draftState.teams[0].id)!;
  const myRoster = myTeam?.roster || [];
  const currentAuctionPlayer = draftState.currentPlayerOnAuction;
  const assignedCount = myRoster.filter(r => r.slotId).length;
  const canSimulate = assignedCount === 11;
  const isHighestBidder = draftState.highestBidderId === myTeam?.id;
  const highestBidderName = draftState.teams.find(t => t.id === draftState.highestBidderId)?.name || "—";
  const myRosterFull = myRoster.length >= 11;

  // Team strength ratings for display
  const teamRatings = assignedCount >= 11 ? getTeamStrengthRatings({
    id: myTeam.id,
    roster: myRoster.filter(r => r.slotId).map(r => ({ player: r.player, slotId: r.slotId })),
    formationId,
  }) : null;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col xl:flex-row gap-0">

      {/* ── LEFT: Pitch ─────────────────────────────────────── */}
      <div className="xl:w-[400px] flex-shrink-0 bg-slate-900/60 border-r border-white/5 flex flex-col p-4 gap-3">
        {/* Formation selector */}
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">My Formation</h2>
          <select
            value={formationId}
            onChange={(e) => setFormationId(e.target.value)}
            className="bg-slate-800 border border-white/10 text-white rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-indigo-500"
          >
            {FORMATIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {/* Team strength ratings */}
        {teamRatings && (
          <div className="flex gap-1.5 text-[10px]">
            {[
              { label: 'ATT', val: teamRatings.attack, color: 'text-red-400' },
              { label: 'MID', val: teamRatings.midfield, color: 'text-emerald-400' },
              { label: 'DEF', val: teamRatings.defense, color: 'text-blue-400' },
              { label: 'GK', val: teamRatings.gk, color: 'text-amber-400' },
              { label: 'OVR', val: teamRatings.overall, color: 'text-white' },
            ].map(r => (
              <div key={r.label} className="flex flex-col items-center bg-slate-800/60 px-2 py-1 rounded-lg border border-white/5">
                <span className="text-slate-500 font-black leading-none">{r.label}</span>
                <span className={`${r.color} font-black text-sm leading-none mt-0.5`}>{r.val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pitch */}
        <DndContext onDragEnd={handleDragEnd}>
          <div className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/5"
            style={{ background: "linear-gradient(180deg, #2d6a2d 0%, #1e5c1e 50%, #2d6a2d 100%)" }}>
            {/* Pitch markings */}
            <div className="absolute inset-[6px] border border-white/20 rounded-xl pointer-events-none" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/20 pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-20 border border-t-0 border-white/20 pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-36 h-20 border border-b-0 border-white/20 pointer-events-none" />
            {/* Vertical pitch stripes */}
            {[20, 40, 60, 80].map(p => (
              <div key={p} className="absolute top-0 bottom-0 w-px bg-white/5 pointer-events-none" style={{ left: `${p}%` }} />
            ))}
            {formation.slots.map(slot => {
              const rosterEntry = myRoster.find(r => r.slotId === slot.id);
              return (
                <PitchSlot key={slot.id} id={slot.id} x={slot.x} y={slot.y} role={slot.role}>
                  {rosterEntry && (
                    <DraggablePlayer
                      id={`player-${rosterEntry.player.id}`}
                      player={rosterEntry.player}
                      modifier={getPositionModifier(rosterEntry.player.positions, slot.role)}
                      slotY={slot.y}
                    />
                  )}
                </PitchSlot>
              );
            })}
          </div>

          {/* Bench */}
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Bench / Unassigned ({myRoster.filter(r => !r.slotId).length})
            </div>
            <BenchArea>
              {myRoster.filter(r => !r.slotId).map(rosterEntry => (
                <DraggablePlayer
                  key={rosterEntry.player.id}
                  id={`player-${rosterEntry.player.id}`}
                  player={rosterEntry.player}
                  modifier={{ modifier: 1, colorClass: "bg-slate-700", label: "Favourable" as const }}
                />
              ))}
              {myRoster.filter(r => !r.slotId).length === 0 && (
                <span className="text-slate-600 text-xs font-medium">Drag players here to bench them</span>
              )}
            </BenchArea>
          </div>
        </DndContext>

        {/* Legend */}
        <div className="flex gap-3 text-[10px] font-semibold text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Natural</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />Slightly off</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Wrong pos</span>
        </div>
      </div>

      {/* ── CENTER: Auction ───────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 relative">

        {draftState.completed ? (
          /* ── Post-draft: lineup confirmation ── */
          <div className="text-center space-y-6 max-w-lg w-full">
            <div className="text-5xl">🏆</div>
            <h2 className="text-4xl font-black text-white">Auction Complete!</h2>
            {draftState.inGracePeriod && (
              <p className="text-amber-400 font-semibold text-sm">
                Some teams received sub-81 rated grace players to complete their squads.
              </p>
            )}
            <p className="text-slate-400 text-lg">
              Set your formation, then start the league!
            </p>
            <div className="mt-2">
              <div className="text-slate-400 text-sm mb-3 font-semibold">
                {assignedCount}/11 players assigned to pitch
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 mb-4">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-blue-400 h-2 rounded-full transition-all"
                  style={{ width: `${(assignedCount / 11) * 100}%` }}
                />
              </div>
              <button
                onClick={handleSimulateMatch}
                disabled={!canSimulate}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black rounded-2xl shadow-xl hover:-translate-y-1 transition-all text-lg tracking-wide disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                🏟️ Start League Season
              </button>
              {!canSimulate && (
                <p className="text-red-400 text-sm mt-2 font-bold">Assign all 11 players to the pitch first!</p>
              )}
            </div>
          </div>

        ) : currentAuctionPlayer && (
          /* ── Live auction ── */
          <div className="flex flex-col items-center w-full max-w-md gap-6">

            {/* Header: bid & bidder */}
            <div className="w-full flex justify-between items-center">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Highest Bidder</div>
                <div className={`text-2xl font-black ${isHighestBidder ? 'text-emerald-400' : 'text-white'}`}>
                  {highestBidderName}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Bid</div>
                <div className="text-4xl font-black text-indigo-400">${draftState.currentBid}</div>
              </div>
            </div>

            {/* Main area */}
            <div className="flex items-center justify-center min-h-[280px] w-full">
              {phase === 'countdown' ? (
                <div className={`text-[140px] font-black text-white leading-none ${countdown > 0 ? 'animate-bounce' : 'text-emerald-400'}`}>
                  {countdown === 0 ? '🔥' : countdown}
                </div>
              ) : phase === 'sold' ? (
                <div className="text-center space-y-3">
                  <div className="text-7xl font-black text-red-500 tracking-tight" style={{ transform: 'rotate(-4deg)' }}>
                    SOLD!
                  </div>
                  <div className="text-2xl font-bold text-slate-300">
                    to <span className="text-white font-black">{highestBidderName}</span> for <span className="text-indigo-400 font-black">${draftState.currentBid}</span>
                  </div>
                </div>
              ) : (
                <AuctionCard player={currentAuctionPlayer} />
              )}
            </div>

            {/* Bidding controls */}
            {phase === 'bidding' && (
              <div className="w-full flex flex-col items-center gap-4">
                {/* Timer bar */}
                <div className="w-full flex items-center gap-3">
                  <div className="flex-1 bg-slate-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${timer <= 3 ? 'bg-red-500' : 'bg-indigo-500'}`}
                      style={{ width: `${(timer / 7) * 100}%` }}
                    />
                  </div>
                  <span className={`font-black text-2xl w-8 text-right tabular-nums ${timer <= 3 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                    {timer}
                  </span>
                </div>

                {/* Base price */}
                <div className="text-slate-500 text-sm font-semibold">
                  Base price: <span className="text-slate-300">${draftState.basePrice}</span>
                </div>

                {/* Bid buttons */}
                <div className="grid grid-cols-4 gap-2 w-full">
                  {[1, 5, 10].map(amt => (
                    <button
                      key={amt}
                      onClick={() => handleBid(amt)}
                      disabled={myRosterFull || isHighestBidder || myTeam!.budget < (draftState.highestBidderId === null ? draftState.basePrice : draftState.currentBid + amt)}
                      className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    >
                      +${amt}
                    </button>
                  ))}
                  <button
                    onClick={handleWithdraw}
                    disabled={myRosterFull || isHighestBidder || phase !== 'bidding'}
                    className="py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    Out
                  </button>
                </div>

                {myRosterFull && (
                  <p className="text-red-400 text-sm font-bold text-center">Your squad is full!</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT: Sidebar (budgets + draft history) ──── */}
      <div className="xl:w-[320px] flex-shrink-0 bg-slate-900/60 border-l border-white/5 flex flex-col p-4 gap-4">

        {/* Team budgets */}
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
            Teams · {(draftState.availablePlayers.length + draftState.sub81Players.length)} players left
          </h3>
          <div className="space-y-2">
            {draftState.teams.map(team => (
              <div
                key={team.id}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${team.isUser
                  ? 'bg-indigo-900/40 border-indigo-500/40'
                  : team.id === draftState.highestBidderId
                    ? 'bg-emerald-900/30 border-emerald-500/30'
                    : 'bg-slate-800/50 border-white/5'}`}
              >
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    {team.name}
                    {team.isUser && <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-black">YOU</span>}
                    {team.id === draftState.highestBidderId && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">{team.roster.length}/11 players</div>
                </div>
                <div className={`text-lg font-black tabular-nums ${team.budget < 100 ? 'text-red-400' : 'text-white'}`}>
                  ${team.budget}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Draft history */}
        <div className="flex-1 flex flex-col">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Recent Picks</h3>
          <div className="flex-1 space-y-1.5 overflow-y-auto">
            {draftHistory.length === 0 ? (
              <div className="text-slate-600 text-xs text-center py-4">Picks will appear here...</div>
            ) : draftHistory.map((entry, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${i === 0 ? 'bg-indigo-900/40 border border-indigo-500/30' : 'bg-slate-800/40'}`}
              >
                <div>
                  <div className="text-xs font-bold text-white">{entry.player.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {entry.player.positions.slice(0, 2).join(" · ")} · {getCountryFlag(entry.player.country)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-indigo-400">${entry.price}</div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[80px]">{entry.teamName}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
