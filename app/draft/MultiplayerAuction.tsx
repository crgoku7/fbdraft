"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { AuctionCard, DraggablePlayer, PitchSlot, BenchArea } from "../../components/draft-ui";
import { FORMATIONS, getPositionModifier } from "../../lib/formation-utils";
import { getTeamStrengthRatings } from "../../lib/match-engine";
import { getCountryFlag } from "../../lib/country-flags";
import { DndContext, DragEndEvent } from '@dnd-kit/core';

const playSound = (src: string) => {
  if (typeof Audio !== "undefined") {
    new Audio(src).play().catch(() => {});
  }
};

export default function MultiplayerAuction({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const room = useQuery(api.rooms.getRoom, { code: roomCode });
  const auction = useQuery(api.auction.getAuction, { roomId: room?._id as any });
  
  const placeBid = useMutation(api.auction.placeBid);
  const withdraw = useMutation(api.auction.withdraw);
  const resolveRound = useMutation(api.auction.resolveRound);
  const startBidding = useMutation(api.auction.startBidding);
  const advanceToNextPlayer = useMutation(api.auction.advanceToNextPlayer);
  const updateSlot = useMutation(api.auction.updateSlot);

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [formationId, setFormationId] = useState(FORMATIONS[0].id);

  // Sync timers
  const [timerDisplay, setTimerDisplay] = useState(7);
  const [countdownDisplay, setCountdownDisplay] = useState(3);
  
  const [draftHistory, setDraftHistory] = useState<any[]>([]);

  useEffect(() => {
    setPlayerId(sessionStorage.getItem("playerId"));
  }, []);

  // Tick the clock for countdown
  useEffect(() => {
    if (!auction || auction.status !== "countdown") return;
    const interval = setInterval(() => {
      if (!auction.timerEnd) return;
      const msLeft = auction.timerEnd - Date.now();
      const sLeft = Math.ceil(msLeft / 1000);
      setCountdownDisplay(Math.max(0, sLeft));

      // Auto start bidding if we are the host and it hits 0
      if (sLeft <= 0 && room?.hostId === playerId) {
        startBidding({ auctionId: auction._id });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [auction?.status, auction?.timerEnd, room?.hostId, playerId, auction, startBidding]);

  // Tick the clock for bidding
  useEffect(() => {
    if (!auction || auction.status !== "bidding") return;
    const interval = setInterval(() => {
      if (!auction.timerEnd) return;
      const msLeft = auction.timerEnd - Date.now();
      const sLeft = Math.ceil(msLeft / 1000);
      setTimerDisplay(Math.max(0, sLeft));

      // Play sound near end
      if (sLeft === 3 && msLeft > 2900 && msLeft < 3000) {
        playSound("/audio/countdown.wav");
      }

      // Auto resolve if we are host and it hits 0
      if (msLeft <= 0 && room?.hostId === playerId) {
        resolveRound({ auctionId: auction._id, teamSize: room.settings.teamSize });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [auction?.status, auction?.timerEnd, room?.hostId, playerId, auction, resolveRound, room?.settings.teamSize]);

  // Auto advance from Sold
  useEffect(() => {
    if (auction?.status === "sold") {
      playSound('/audio/sold.wav');
      // Add to history
      if (auction.currentPlayer) {
        const winner = auction.teams.find((t: any) => t.id === auction.highestBidderId);
        setDraftHistory(prev => [{
          player: auction.currentPlayer,
          teamName: winner?.name ?? "No bid",
          price: auction.currentBid,
        }, ...prev].slice(0, 12));
      }

      if (room?.hostId === playerId) {
        setTimeout(() => {
          advanceToNextPlayer({ auctionId: auction._id, teamSize: room.settings.teamSize });
        }, 3000);
      }
    }
  }, [auction?.status]); // intentionally shallow

  // Auto-assign unassigned players to an available position matching their role
  useEffect(() => {
    if (!myTeam || !playerId) return;
    const formation = FORMATIONS.find(f => f.id === formationId) || FORMATIONS[0];
    const unassigned = myTeam.roster.filter((r: any) => !r.slotId);
    
    unassigned.forEach((u: any) => {
      // Find a slot that is empty
      const emptySlot = formation.slots.find(s => {
        const isOccupied = myTeam.roster.some((r: any) => r.slotId === s.id);
        if (isOccupied) return false;
        // Check if role matches
        // For simplicity, just place them in the first empty slot to ensure they appear on pitch
        // You could enforce strict roles here if needed
        return true;
      });

      if (emptySlot) {
        updateSlot({
          auctionId: auction._id,
          teamId: playerId,
          playerId: u.player.id,
          slotId: emptySlot.id
        });
      }
    });
  }, [myTeam?.roster.length, formationId]);

  if (!room || !auction || !playerId) {
    return <div className="min-h-screen bg-[#0a0e1a] text-white flex items-center justify-center font-bold tracking-widest animate-pulse">CONNECTING TO LOBBY...</div>;
  }

  const formation = FORMATIONS.find(f => f.id === formationId) || FORMATIONS[0];
  const myTeam = auction.teams.find((t: any) => t.id === playerId);
  if (!myTeam) {
    return <div className="text-white text-center mt-20">You are not part of this draft.</div>;
  }
  
  const myRoster = myTeam.roster || [];
  const currentAuctionPlayer = auction.currentPlayer;
  const assignedCount = myRoster.filter((r: any) => r.slotId).length;
  const canSimulate = assignedCount === 11;
  const isHighestBidder = auction.highestBidderId === myTeam.id;
  const highestBidderName = auction.teams.find((t: any) => t.id === auction.highestBidderId)?.name || "—";
  const myRosterFull = myRoster.length >= room.settings.teamSize;

  const handleBid = (amt: number) => {
    playSound(`/audio/price${amt}.wav`);
    placeBid({ auctionId: auction._id, teamId: playerId, bidIncrease: amt });
  };

  const handleWithdraw = () => {
    withdraw({ auctionId: auction._id, teamId: playerId });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !auction || !playerId) return;

    const draggedPlayerId = parseInt(String(active.id).split('-')[1]);
    const overId = String(over.id);
    const slotId = overId === "bench" ? null : overId;

    updateSlot({
      auctionId: auction._id,
      teamId: playerId,
      playerId: draggedPlayerId,
      slotId: slotId
    });
  };

  return (
    <div className="h-screen bg-[#0a0e1a] text-white flex flex-col xl:flex-row gap-0 overflow-hidden">
      {/* ── LEFT: Pitch ─────────────────────────────────────── */}
      <div className="xl:w-[400px] flex-shrink-0 bg-slate-900/60 border-r border-white/5 flex flex-col p-4 gap-3 overflow-y-auto">
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

        <DndContext onDragEnd={handleDragEnd}>
          <div className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/5"
            style={{ background: "linear-gradient(180deg, #2d6a2d 0%, #1e5c1e 50%, #2d6a2d 100%)" }}>
            <div className="absolute inset-[6px] border border-white/20 rounded-xl pointer-events-none" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/20 pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-20 border border-t-0 border-white/20 pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-36 h-20 border border-b-0 border-white/20 pointer-events-none" />
            {formation.slots.map(slot => {
              const rosterEntry = myRoster.find((r: any) => r.slotId === slot.id);
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

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Bench / Unassigned ({myRoster.filter((r: any) => !r.slotId).length})
            </div>
            <BenchArea>
              {myRoster.filter((r: any) => !r.slotId).map((rosterEntry: any) => (
                <DraggablePlayer
                  key={rosterEntry.player.id}
                  id={`player-${rosterEntry.player.id}`}
                  player={rosterEntry.player}
                  modifier={{ modifier: 1, colorClass: "bg-slate-700", label: "Favourable" as const }}
                />
              ))}
            </BenchArea>
          </div>
        </DndContext>
      </div>

      {/* ── CENTER: Auction ───────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 relative overflow-y-auto">
        {auction.status === "completed" ? (
          <div className="text-center space-y-6 max-w-lg w-full">
            <div className="text-5xl">🏆</div>
            <h2 className="text-4xl font-black text-white">Auction Complete!</h2>
            <p className="text-slate-400 text-lg">
              Set your formation, then start the league!
            </p>
          </div>
        ) : currentAuctionPlayer && (
          <div className="flex flex-col items-center w-full max-w-md gap-6">
            <div className="w-full flex justify-between items-center">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Highest Bidder</div>
                <div className={`text-2xl font-black ${isHighestBidder ? 'text-emerald-400' : 'text-white'}`}>
                  {highestBidderName}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Bid</div>
                <div className="text-4xl font-black text-indigo-400">${auction.currentBid}</div>
              </div>
            </div>

            <div className="flex items-center justify-center min-h-[280px] w-full">
              {auction.status === "countdown" ? (
                <div className={`text-[140px] font-black text-white leading-none ${countdownDisplay > 0 ? 'animate-bounce' : 'text-emerald-400'}`}>
                  {countdownDisplay === 0 ? '🔥' : countdownDisplay}
                </div>
              ) : auction.status === "sold" ? (
                <div className="text-center space-y-3">
                  <div className="text-7xl font-black text-red-500 tracking-tight" style={{ transform: 'rotate(-4deg)' }}>
                    SOLD!
                  </div>
                  <div className="text-2xl font-bold text-slate-300">
                    to <span className="text-white font-black">{highestBidderName}</span> for <span className="text-indigo-400 font-black">${auction.currentBid}</span>
                  </div>
                </div>
              ) : (
                <AuctionCard player={currentAuctionPlayer} />
              )}
            </div>

            {auction.status === 'bidding' && (
              <div className="w-full flex flex-col items-center gap-4">
                <div className="w-full flex items-center gap-3">
                  <div className="flex-1 bg-slate-800 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-100 ${timerDisplay <= 3 ? 'bg-red-500' : 'bg-indigo-500'}`}
                      style={{ width: `${(timerDisplay / 7) * 100}%` }}
                    />
                  </div>
                  <span className={`font-black text-2xl w-8 text-right tabular-nums ${timerDisplay <= 3 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                    {timerDisplay}
                  </span>
                </div>

                <div className="text-slate-500 text-sm font-semibold">
                  Base price: <span className="text-slate-300">${auction.basePrice}</span>
                </div>

                <div className="grid grid-cols-4 gap-2 w-full">
                  {[1, 5, 10].map(amt => (
                    <button
                      key={amt}
                      onClick={() => handleBid(amt)}
                      disabled={myRosterFull || isHighestBidder || myTeam!.budget < (auction.highestBidderId === null ? auction.basePrice : auction.currentBid + amt) || myTeam.hasWithdrawnFromCurrent}
                      className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    >
                      +${amt}
                    </button>
                  ))}
                  <button
                    onClick={handleWithdraw}
                    disabled={myRosterFull || isHighestBidder || myTeam.hasWithdrawnFromCurrent}
                    className={`py-3 font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm ${myTeam.hasWithdrawnFromCurrent ? 'bg-red-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                  >
                    {myTeam.hasWithdrawnFromCurrent ? 'Withdrawn' : 'Out'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT: Sidebar ──────────────────────────────── */}
      <div className="xl:w-[320px] flex-shrink-0 bg-slate-900/60 border-l border-white/5 flex flex-col p-4 gap-4 overflow-y-auto">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
            Teams · {auction.availablePlayers.length} left
          </h3>
          <div className="space-y-2">
            {auction.teams.map((team: any) => (
              <div
                key={team.id}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${team.id === playerId
                  ? 'bg-indigo-900/40 border-indigo-500/40'
                  : team.id === auction.highestBidderId
                    ? 'bg-emerald-900/30 border-emerald-500/30'
                    : 'bg-slate-800/50 border-white/5'}`}
              >
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    {team.name}
                    {team.id === playerId && <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-black">YOU</span>}
                    {team.hasWithdrawnFromCurrent && auction.status === 'bidding' && <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black">OUT</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">{team.roster.length}/{room.settings.teamSize}</div>
                </div>
                <div className={`text-lg font-black tabular-nums ${team.budget < 100 ? 'text-red-400' : 'text-white'}`}>
                  ${team.budget}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Recent Picks</h3>
          <div className="flex-1 space-y-1.5 overflow-y-auto">
            {draftHistory.map((entry, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${i === 0 ? 'bg-indigo-900/40 border border-indigo-500/30' : 'bg-slate-800/40'}`}
              >
                <div>
                  <div className="text-xs font-bold text-white">{entry.player.name}</div>
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
