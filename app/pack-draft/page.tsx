"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { loadPlayers, type Player } from "../../lib/player-data";
import { FORMATIONS, getPositionModifier } from "../../lib/formation-utils";
import { generatePack, generateAITeams } from "../../lib/pack-engine";
import { AuctionCard, PitchSlot, DraggablePlayer, BenchArea } from "../../components/draft-ui";
import { GameSettingsForm, type GameSettings, DEFAULT_SETTINGS } from "../../components/shared-ui";
import { DndContext, DragEndEvent } from "@dnd-kit/core";

type PackDraftState = {
  formationId: string;
  roster: { player: Player; slotId: string | null }[];
};

export default function PackDraftPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftState, setDraftState] = useState<PackDraftState | null>(null);
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS, budget: 0 });
  const [showSettings, setShowSettings] = useState(true);
  
  // Drafting flow state
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [currentPack, setCurrentPack] = useState<Player[]>([]);
  
  // Dnd state (for adjusting post-draft)
  const isPostDraft = draftState?.roster.length === settings.teamSize;

  useEffect(() => {
    setPlayers(loadPlayers());
  }, []);

  // Generate a pack when moving to a new slot
  useEffect(() => {
    if (!draftState || isPostDraft || players.length === 0) return;
    const formation = FORMATIONS.find(f => f.id === draftState.formationId)!;
    const currentSlot = formation.slots[currentSlotIndex] || { role: "BENCH" };
    if (currentSlot) {
      const excludedIds = new Set(draftState.roster.map(r => r.player.id));
      const pack = generatePack(currentSlot.role, players, excludedIds);
      setCurrentPack(pack);
    }
  }, [draftState, currentSlotIndex, isPostDraft, players]);

  if (players.length === 0) return null;

  // 0. Settings Screen
  if (showSettings) {
    return (
      <GameSettingsForm
        settings={settings}
        onChange={setSettings}
        onStart={() => setShowSettings(false)}
        disabled={players.length === 0}
        title="Pack Draft Settings"
        accent="emerald"
        showBudget={false}
      />
    );
  }

  // 1. Formation Selection Phase
  if (!draftState) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-white">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 mb-8">
          Select Formation
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl">
          {FORMATIONS.map(f => (
            <button
              key={f.id}
              onClick={() => {
                if (typeof Audio !== "undefined") {
                  new Audio('/audio/click.wav').play().catch(() => {});
                }
                setDraftState({ formationId: f.id, roster: [] });
              }}
              className="p-6 rounded-2xl bg-slate-900 border-2 border-white/10 hover:border-emerald-500/50 hover:bg-slate-800 transition-all font-black text-2xl tracking-widest text-slate-300 hover:text-white"
            >
              {f.id}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const formation = FORMATIONS.find(f => f.id === draftState.formationId)!;
  const currentSlotToDraft = isPostDraft ? null : (formation.slots[currentSlotIndex] || { id: `bench_${currentSlotIndex}`, role: "BENCH", x: 0, y: 0 });

  const handlePickPlayer = (player: Player) => {
    if (!currentSlotToDraft) return;
    setDraftState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        roster: [...prev.roster, { player, slotId: currentSlotToDraft.id.startsWith("bench_") ? null : currentSlotToDraft.id }]
      };
    });
    setCurrentSlotIndex(prev => prev + 1);
  };

  const handleStartTournament = () => {
    if (!isPostDraft) return;
    // Build user team
    const userTeam = {
      id: "pack_user_team",
      name: "Your Squad",
      isUser: true,
      roster: draftState.roster,
      formationId: draftState.formationId,
      budget: 0
    };

    // Build AI teams
    const usedIds = new Set(draftState.roster.map(r => r.player.id));
    const aiTeams = generateAITeams(players, settings.aiCount, usedIds, settings.teamSize);

    const leagueTeams = [userTeam, ...aiTeams];
    localStorage.setItem("fbdraft_league_teams", JSON.stringify(leagueTeams));
    
    if (settings.tournamentType === "KNOCKOUT") {
      router.push("/knockout");
    } else {
      router.push("/league");
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    if (!isPostDraft) return; // Only allow drag and drop after drafting
    const { active, over } = e;
    if (!over) return;
    
    setDraftState(prev => {
      if (!prev) return prev;
      const newRoster = [...prev.roster];
      const sourceIdx = newRoster.findIndex(r => r.player.id.toString() === active.id);
      const targetIdx = newRoster.findIndex(r => r.slotId === over.id);

      if (sourceIdx !== -1) {
        if (over.id === "bench") {
          newRoster[sourceIdx].slotId = null;
        } else {
          const targetIdx = newRoster.findIndex(r => r.slotId === over.id);
          if (targetIdx !== -1) {
            // Swap
            const tempSlot = newRoster[sourceIdx].slotId;
            newRoster[sourceIdx].slotId = newRoster[targetIdx].slotId;
            newRoster[targetIdx].slotId = tempSlot;
          } else {
            // Move
            newRoster[sourceIdx].slotId = over.id as string;
          }
        }
      }
      return { ...prev, roster: newRoster };
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200 overflow-hidden flex flex-col font-sans">
      <header className="h-16 border-b border-white/5 bg-slate-900/50 flex items-center justify-between px-6 shrink-0">
        <div className="font-black text-xl tracking-tight text-white flex gap-2 items-center">
          <span className="text-emerald-500">PACK</span> DRAFT
        </div>
        <div className="text-sm font-bold text-slate-400 bg-slate-800 px-4 py-1.5 rounded-full border border-white/10">
          {draftState.roster.length} / {settings.teamSize} Players
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left: Pitch */}
        <div className="w-1/3 min-w-[400px] border-r border-white/5 bg-slate-900/20 p-6 flex flex-col items-center relative overflow-y-auto gap-6">
          <DndContext onDragEnd={handleDragEnd}>
            <div 
              className="relative w-full max-w-[400px] rounded-2xl overflow-hidden shadow-2xl border-[3px] border-white/10 shrink-0" 
              style={{ 
                paddingTop: "135%", 
                background: "linear-gradient(180deg, #1a4a1a 0%, #163f16 50%, #1a4a1a 100%)" 
              }}
            >
              {/* Pitch graphics */}
              <div className="absolute inset-2 border-2 border-white/15 rounded-lg pointer-events-none" />
              <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/15 pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-white/15 pointer-events-none" />

              {formation.slots.map(slot => {
                const rosterItem = draftState.roster.find(r => r.slotId === slot.id);
                const isCurrentlyDrafting = !isPostDraft && currentSlotToDraft?.id === slot.id;
                return (
                  <PitchSlot 
                    key={slot.id} 
                    id={slot.id} 
                    x={slot.x} 
                    y={slot.y} 
                    role={slot.role}
                    isHighlighted={isCurrentlyDrafting}
                  >
                    {rosterItem && (
                      <DraggablePlayer 
                        id={rosterItem.player.id.toString()} 
                        player={rosterItem.player} 
                        modifier={getPositionModifier(rosterItem.player.positions, slot.role)}
                        slotY={slot.y}
                      />
                    )}
                  </PitchSlot>
                );
              })}
            </div>

            {settings.teamSize > 11 && (
              <div className="w-full max-w-[400px]">
                <h3 className="text-slate-400 font-black tracking-widest uppercase text-sm mb-2">Bench</h3>
                <BenchArea>
                  {draftState.roster.filter(r => r.slotId === null).map(r => (
                    <DraggablePlayer 
                      key={r.player.id}
                      id={r.player.id.toString()} 
                      player={r.player} 
                      modifier={{ modifier: 1, colorClass: "bg-slate-700" }} 
                    />
                  ))}
                  {draftState.roster.filter(r => r.slotId === null).length === 0 && (
                    <div className="text-slate-500 text-xs font-bold w-full text-center">
                      {isPostDraft ? "Drop players here" : "Bench players will appear here"}
                    </div>
                  )}
                </BenchArea>
              </div>
            )}
          </DndContext>
        </div>

        {/* Right: Pack / Post-Draft Action */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-900/40 to-black overflow-y-auto">
          {!isPostDraft ? (
            <>
              <div className="mb-8 text-center space-y-2">
                <h2 className="text-3xl font-black text-white">Select a Player</h2>
                <p className="text-emerald-400 font-semibold tracking-widest uppercase">Drafting for {currentSlotToDraft?.role}</p>
              </div>
              
              <div className="flex flex-col items-center gap-6 max-w-5xl">
                {/* Top Row: 3 cards */}
                <div className="flex justify-center gap-6">
                  {currentPack.slice(0, 3).map(p => (
                    <div key={`${currentSlotIndex}-${p.id}`} className="animate-swivel-in">
                      <AuctionCard player={p} onClick={() => handlePickPlayer(p)} />
                    </div>
                  ))}
                </div>
                {/* Bottom Row: 2 cards */}
                <div className="flex justify-center gap-6">
                  {currentPack.slice(3, 5).map(p => (
                    <div key={`${currentSlotIndex}-${p.id}`} className="animate-swivel-in" style={{ animationDelay: "150ms" }}>
                      <AuctionCard player={p} onClick={() => handlePickPlayer(p)} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center space-y-6 flex flex-col items-center">
              <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 border-2 border-emerald-500">
                <span className="text-4xl">✅</span>
              </div>
              <h2 className="text-5xl font-black text-white tracking-tight">Draft Complete</h2>
              <p className="text-slate-400 text-lg max-w-md">
                You have assembled your squad. You can drag and drop players on the pitch to adjust positions.
              </p>
              <button
                onClick={handleStartTournament}
                className="mt-8 px-10 py-5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xl rounded-2xl shadow-xl hover:shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95"
              >
                {settings.tournamentType === "KNOCKOUT" ? "START KNOCKOUT TOURNAMENT" : "START LEAGUE SEASON"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
