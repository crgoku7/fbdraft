"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { 
  createAuctionSession, 
  placeBid, 
  concludeAuctionForCurrentPlayer, 
  getAIBidDecision,
  autoCompleteAuction,
  type AuctionState 
} from "../../lib/auction-engine";
import { loadPlayers, type Player } from "../../lib/player-data";
import { FORMATIONS, getPositionModifier, type PositionModifierResult } from "../../lib/formation-utils";
import { useRouter } from "next/navigation";
import { optimizeTeamFormation } from "../../lib/ai-formation";

function DraggablePlayer({ player, id, modifier }: { player: Player, id: string, modifier: PositionModifierResult }) {
  const {attributes, listeners, setNodeRef, transform} = useDraggable({ id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  
  const effectiveRating = Math.floor(player.rating * modifier.modifier);

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      className="relative flex flex-col items-center justify-center cursor-grab active:cursor-grabbing group"
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg border-2 border-white/20 transition-transform group-hover:scale-110 ${modifier.colorClass}`}>
        {effectiveRating}
      </div>
      <div className="absolute top-12 mt-1 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 flex flex-col items-center pointer-events-none w-max">
        <span className="font-bold">{player.name}</span>
        <span className="text-blue-300">{player.positions.join(", ")}</span>
        {player.traits.length > 0 && <span className="text-yellow-400 mt-0.5 whitespace-nowrap">{player.traits.join(", ")}</span>}
      </div>
      <div className="mt-1 bg-slate-900/60 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded truncate max-w-[60px] text-center font-medium shadow-sm border border-white/10">
        {player.name.split(' ').pop()}
      </div>
    </div>
  );
}

function PitchSlot({ id, x, y, role, children }: { id: string, x: number, y: number, role: string, children: React.ReactNode }) {
  const {isOver, setNodeRef} = useDroppable({ id });
  
  return (
    <div 
      ref={setNodeRef}
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
      className={`absolute w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isOver ? 'bg-white/30 border-2 border-white/50' : 'bg-transparent border border-white/20 border-dashed'}`}
    >
      {!children && (
        <span className="text-white/40 text-[10px] font-bold">{role}</span>
      )}
      {children}
    </div>
  );
}

function BenchArea({ children }: { children: React.ReactNode }) {
  const {isOver, setNodeRef} = useDroppable({ id: "bench" });
  
  return (
    <div 
      ref={setNodeRef}
      className={`mt-4 p-4 rounded-xl min-h-[80px] flex flex-wrap gap-4 items-center transition-colors ${isOver ? 'bg-white/10 border-2 border-white/50' : 'bg-slate-800/50 border border-white/10'}`}
    >
      {children}
    </div>
  );
}

export default function DraftPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftState, setDraftState] = useState<AuctionState | null>(null);
  
  // Timers and Phases
  const [phase, setPhase] = useState<'countdown' | 'bidding' | 'sold'>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(7);
  
  // Formation and UI
  const [formationId, setFormationId] = useState(FORMATIONS[0].id);
  const previousRosterLength = useRef(0);

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
            if (!chosenSlot) {
              chosenSlot = formation.slots.find(s => !usedSlots.has(s.id));
            }
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

  // Load players on mount
  useEffect(() => {
    setPlayers(loadPlayers());
  }, []);

  const handleStartDraft = () => {
    if (players.length === 0) return;
    const initial = createAuctionSession(players);
    setDraftState(initial);
    setPhase('countdown');
    setCountdown(3);
    setTimer(7);
  };

  const handleSimulateMatch = () => {
    if (!draftState || !draftState.completed) return;
    
    const leagueTeams = draftState.teams.map(team => {
      if (team.isUser) {
        return {
          id: team.id,
          name: team.name,
          isUser: team.isUser,
          roster: team.roster,
          formationId: formationId
        };
      } else {
        const optimized = optimizeTeamFormation(team.roster.map(r => r.player));
        return {
          id: team.id,
          name: team.name,
          isUser: team.isUser,
          roster: optimized.roster,
          formationId: optimized.formationId
        };
      }
    });

    localStorage.setItem("fbdraft_league_teams", JSON.stringify(leagueTeams));
    router.push("/league");
  };

  const handleBid = (amount: number) => {
    if (!draftState || phase !== 'bidding') return;
    const nextState = placeBid(draftState, draftState.teams[0].id, amount);
    setDraftState(nextState);
    setTimer(7); // Reset timer on bid
  };

  const handleWithdraw = () => {
    if (!draftState || phase !== 'bidding') return;
    const isHighest = draftState.highestBidderId === draftState.teams[0].id;
    if (isHighest) return;

    const nextState = autoCompleteAuction(draftState);
    setDraftState(nextState);
    setPhase('countdown');
    setCountdown(3);
  };

  // Timer loop
  useEffect(() => {
    if (!draftState || draftState.completed) return;

    if (phase === 'countdown') {
      if (countdown > 0) {
        const t = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(t);
      } else {
        setPhase('bidding');
        setTimer(7);
      }
    } else if (phase === 'bidding') {
      if (timer > 0) {
        const t = setTimeout(() => setTimer(timer - 1), 1000);
        return () => clearTimeout(t);
      } else {
        setPhase('sold');
        setTimeout(() => {
          setDraftState(prev => {
            if (!prev) return prev;
            return concludeAuctionForCurrentPlayer(prev);
          });
          setPhase('countdown');
          setCountdown(3);
        }, 2000);
      }
    }
  }, [phase, countdown, timer, draftState]);

  // AI Bidding loop
  useEffect(() => {
    if (!draftState || draftState.completed || phase !== 'bidding') return;
    
    const interval = setInterval(() => {
      if (timer <= 0) return;
      if (Math.random() > 0.6) {
        const decision = getAIBidDecision(draftState);
        if (decision) {
          setDraftState(prev => {
            if (!prev) return prev;
            return placeBid(prev, decision.teamId, decision.bidIncrease);
          });
          setTimer(7);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [draftState, timer, phase]);

  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;
    if (!over || !draftState) return;

    const playerIdStr = String(active.id); // "player-123"
    const playerId = parseInt(playerIdStr.split('-')[1]);
    const overId = String(over.id);
    const slotId = overId === "bench" ? undefined : overId;

    setDraftState(prev => {
      if (!prev) return prev;
      
      const nextTeams = [...prev.teams];
      const myTeamIdx = nextTeams.findIndex(t => t.id === prev.teams[0].id);
      if (myTeamIdx === -1) return prev;
      
      const myRoster = [...nextTeams[myTeamIdx].roster];
      
      // Find player
      const playerIdx = myRoster.findIndex(r => r.player.id === playerId);
      if (playerIdx === -1) return prev;

      // Check if slot is occupied (if moving to a valid slot)
      const occupiedIdx = slotId ? myRoster.findIndex(r => r.slotId === slotId) : -1;
      
      if (occupiedIdx !== -1) {
        // Swap slots
        const tempSlot = myRoster[playerIdx].slotId;
        myRoster[playerIdx].slotId = slotId;
        myRoster[occupiedIdx].slotId = tempSlot;
      } else {
        // Move to slot or bench
        myRoster[playerIdx].slotId = slotId;
      }

      nextTeams[myTeamIdx] = { ...nextTeams[myTeamIdx], roster: myRoster };
      return { ...prev, teams: nextTeams };
    });
  };

  if (!draftState) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8">
        <div className="glass-panel p-12 rounded-3xl max-w-lg w-full text-center space-y-6">
          <div className="w-20 h-20 bg-indigo-600 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Auction Draft Engine</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Bid against 7 AI managers in real-time. Build your ultimate formation. (Milestone 2)
          </p>
          <button 
            onClick={handleStartDraft}
            disabled={players.length === 0}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-xl transition-all hover:-translate-y-1 hover:shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {players.length === 0 ? "Loading Data..." : "Start Auction Draft"}
          </button>
        </div>
      </div>
    );
  }

  const formation = FORMATIONS.find(f => f.id === formationId) || FORMATIONS[0];
  const myTeam = draftState.teams.find(t => t.id === draftState.teams[0].id);
  const myRoster = myTeam?.roster || [];
  const currentAuctionPlayer = draftState.currentPlayerOnAuction;
  const assignedCount = myRoster.filter(r => r.slotId).length;
  const canSimulate = assignedCount === 11;

  const isHighestBidder = draftState.highestBidderId === myTeam?.id;
  const highestBidderName = draftState.teams.find(t => t.id === draftState.highestBidderId)?.name || "None";
  const myRosterFull = myRoster.length >= 11;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 flex flex-col xl:flex-row gap-8">
      <DndContext onDragEnd={handleDragEnd}>
        
        {/* Left Panel: Pitch & Formation */}
        <div className="xl:w-[450px] flex-shrink-0 space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">My Formation</h2>
            <select 
              value={formationId}
              onChange={(e) => setFormationId(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-1.5 font-medium outline-none"
            >
              {FORMATIONS.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div className="relative w-full aspect-[2/3] bg-green-600 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800 dark:border-slate-700 pitch-bg">
            {/* Pitch Lines (Decorative) */}
            <div className="absolute inset-0 border-[6px] border-white/20 m-4 rounded-xl pointer-events-none" />
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/20 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-4 border-white/20 pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 border-4 border-t-0 border-white/20 pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-32 border-4 border-b-0 border-white/20 pointer-events-none" />

            {/* Slots and Players */}
            {formation.slots.map(slot => {
              const rosterEntry = myRoster.find(r => r.slotId === slot.id);
              return (
                <PitchSlot key={slot.id} id={slot.id} x={slot.x} y={slot.y} role={slot.role}>
                  {rosterEntry && (
                    <DraggablePlayer 
                      id={`player-${rosterEntry.player.id}`} 
                      player={rosterEntry.player} 
                      modifier={getPositionModifier(rosterEntry.player.positions, slot.role)}
                    />
                  )}
                </PitchSlot>
              );
            })}
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Unassigned / Bench</h3>
            <BenchArea>
              {myRoster.filter(r => !r.slotId).map(rosterEntry => (
                <DraggablePlayer 
                  key={`bench-${rosterEntry.player.id}`}
                  id={`player-${rosterEntry.player.id}`} 
                  player={rosterEntry.player} 
                  modifier={{ modifier: 1, colorClass: "bg-slate-600" }}
                />
              ))}
            </BenchArea>
          </div>
        </div>

      </DndContext>

      {/* Center Panel: Auction Board */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-6">
        {draftState.completed ? (
          <div className="glass-panel p-12 rounded-3xl text-center space-y-6 w-full max-w-xl">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white">Auction Complete!</h2>
            {draftState.inGracePeriod && (
              <p className="text-yellow-600 dark:text-yellow-400 font-medium">Teams missing players have been assigned sub-81 rated players as grace.</p>
            )}
            <p className="text-xl text-slate-500 dark:text-slate-400">All teams have their 11-man roster ready.</p>
            <div className="py-4 flex flex-col items-center">
              <button 
                onClick={handleSimulateMatch}
                disabled={!canSimulate}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-xl hover:-translate-y-1 transition-all text-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                Go to League Dashboard
              </button>
              {!canSimulate && (
                <p className="text-red-500 text-sm mt-2 font-bold">You must assign all 11 players to the pitch first!</p>
              )}
            </div>
          </div>
        ) : currentAuctionPlayer && (
          <div className="glass-panel p-8 md:p-12 rounded-3xl w-full max-w-xl flex flex-col items-center relative overflow-hidden">
            
            {/* Status Header */}
            <div className="w-full flex justify-between items-center mb-8">
              <div className="flex flex-col">
                <span className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">Highest Bidder</span>
                <span className={`text-xl font-black ${isHighestBidder ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                  {highestBidderName}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider">Current Bid</span>
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400">${draftState.currentBid}</span>
              </div>
            </div>

            {/* Main Center Area: Countdown or Card */}
            <div className="h-64 flex items-center justify-center w-full mb-8">
              {phase === 'countdown' ? (
                <div className="text-[120px] font-black text-slate-900 dark:text-white animate-pulse">
                  {countdown === 0 ? 'GO!' : countdown}
                </div>
              ) : phase === 'sold' ? (
                <div className="text-center space-y-4">
                  <div className="text-6xl font-black text-red-600 dark:text-red-500 tracking-tighter transform -rotate-6">SOLD!</div>
                  <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">to {highestBidderName} for ${draftState.currentBid}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
                  <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-white dark:border-slate-800">
                    <span className="text-4xl font-black text-white">{currentAuctionPlayer.rating}</span>
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center">{currentAuctionPlayer.name}</h2>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium text-lg">
                    <span>{currentAuctionPlayer.country}</span>
                    <span>•</span>
                    <div className="flex gap-1">
                      {currentAuctionPlayer.positions.map(p => (
                        <span key={p} className="bg-slate-200 dark:bg-slate-800 px-2 rounded">{p}</span>
                      ))}
                    </div>
                  </div>
                  {currentAuctionPlayer.traits.length > 0 && (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-sm font-semibold mt-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      {currentAuctionPlayer.traits.slice(0, 2).join(", ")}{currentAuctionPlayer.traits.length > 2 && "..."}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bidding Controls */}
            {phase === 'bidding' && (
              <div className="w-full flex flex-col items-center space-y-6">
                <div className="flex items-center gap-4">
                  <div className="text-slate-500 dark:text-slate-400 font-bold">Time remaining:</div>
                  <div className={`text-3xl font-black tabular-nums ${timer <= 3 ? 'text-red-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
                    00:0{timer}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                  <button 
                    onClick={() => handleBid(1)}
                    disabled={myRosterFull || isHighestBidder || myTeam!.budget < (draftState.highestBidderId === null ? draftState.basePrice : draftState.currentBid + 1)}
                    className="py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Bid +$1
                  </button>
                  <button 
                    onClick={() => handleBid(5)}
                    disabled={myRosterFull || isHighestBidder || myTeam!.budget < (draftState.highestBidderId === null ? draftState.basePrice : draftState.currentBid + 5)}
                    className="py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Bid +$5
                  </button>
                  <button 
                    onClick={() => handleBid(10)}
                    disabled={myRosterFull || isHighestBidder || myTeam!.budget < (draftState.highestBidderId === null ? draftState.basePrice : draftState.currentBid + 10)}
                    className="py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Bid +$10
                  </button>
                  <button 
                    onClick={handleWithdraw}
                    disabled={myRosterFull || isHighestBidder || phase !== 'bidding'}
                    className="py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl border-2 border-transparent hover:bg-slate-300 dark:hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Withdraw
                  </button>
                </div>
                
                {myRosterFull && (
                  <p className="text-red-500 font-bold">Your roster is full! You cannot bid anymore.</p>
                )}
                
                <p className="text-slate-500 dark:text-slate-400 text-sm">Base Price: ${draftState.basePrice}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Panel: Standings & Budgets */}
      <div className="xl:w-[350px] flex-shrink-0 space-y-4">
        <div className="glass-panel p-6 rounded-2xl space-y-4 h-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Auction Status</h2>
            <span className="text-sm font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-600 dark:text-slate-300">
              {draftState.availablePlayers.length + draftState.sub81Players.length} Left
            </span>
          </div>

          <div className="space-y-3">
            {draftState.teams.map(team => (
              <div 
                key={team.id} 
                className={`flex justify-between items-center p-3 rounded-xl border ${team.isUser ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    {team.name}
                    {team.id === draftState.highestBidderId && (
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    )}
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{team.roster.length}/11 Players</span>
                </div>
                <span className={`font-black ${team.budget < 100 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                  ${team.budget}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
    </div>
  );
}
