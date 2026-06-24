"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const playClick = () => {
  if (typeof Audio !== "undefined") {
    new Audio("/audio/click.wav").play().catch(() => {});
  }
};

export default function RoomLobbyPage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const { code } = use(params);
  
  const room = useQuery(api.rooms.getRoom, { code });
  const toggleReady = useMutation(api.rooms.toggleReady);
  const startDraft = useMutation(api.rooms.startDraft);
  const initAuction = useMutation(api.auction.initAuction);

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playersData, setPlayersData] = useState<any[]>([]);

  useEffect(() => {
    // We dynamically import loadPlayers so we can pass it to initAuction if we are the host
    import("../../../lib/player-data").then((m) => {
      setPlayersData(m.loadPlayers());
    });
  }, []);

  useEffect(() => {
    const id = sessionStorage.getItem("playerId");
    if (id) {
      setPlayerId(id);
    } else {
      // If they somehow got here without an ID, redirect to multiplayer menu
      router.push("/multiplayer");
    }
  }, [router]);

  useEffect(() => {
    if (room && room.status === "drafting") {
      // Transition to draft mode
      if (room.settings.draftType === "pack") {
        router.push(`/pack-draft?room=${room.code}`);
      } else {
        router.push(`/draft?room=${room.code}`);
      }
    }
  }, [room, router]);

  if (room === undefined || !playerId) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="animate-pulse text-indigo-400 font-bold text-xl tracking-widest">LOADING...</div>
      </div>
    );
  }

  if (room === null) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex flex-col items-center justify-center text-white">
        <h1 className="text-4xl font-black mb-4">Room Not Found</h1>
        <button onClick={() => router.push("/multiplayer")} className="text-indigo-400 font-bold hover:text-white">
          Return to Menu
        </button>
      </div>
    );
  }

  const me = room.players.find(p => p.id === playerId);
  const isHost = room.hostId === playerId;
  const allReady = room.players.every(p => p.isReady);

  const handleToggleReady = async () => {
    playClick();
    if (!me) return;
    await toggleReady({ code, playerId });
  };

  const handleStartDraft = async () => {
    playClick();
    if (!room || !playerId) return;

    if (room.settings.draftType === "auction") {
      await initAuction({ roomId: room._id, players: playersData });
    }
    
    await startDraft({ code, hostId: playerId });
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200 p-8 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-4xl flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
        <div>
          <h1 className="text-sm font-black text-slate-500 tracking-widest uppercase mb-1">
            Lobby Code
          </h1>
          <div className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400 tracking-widest">
            {room.code}
          </div>
        </div>
        
        <div className="flex gap-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5">
          <div className="text-center">
            <div className="text-xs text-slate-500 font-bold uppercase">Mode</div>
            <div className="font-black text-white capitalize">{room.settings.draftType}</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <div className="text-xs text-slate-500 font-bold uppercase">Size</div>
            <div className="font-black text-white">{room.settings.teamSize}v{room.settings.teamSize}</div>
          </div>
          <div className="w-px bg-white/10" />
          <div className="text-center">
            <div className="text-xs text-slate-500 font-bold uppercase">Players</div>
            <div className="font-black text-white">{room.players.length}/{room.settings.maxPlayers}</div>
          </div>
        </div>
      </div>

      {/* Players Grid */}
      <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
        {room.players.map(p => (
          <div 
            key={p.id} 
            className={`p-5 rounded-2xl border-2 transition-all ${
              p.isReady 
                ? "bg-emerald-900/20 border-emerald-500/50" 
                : "bg-slate-900 border-white/10"
            } ${p.id === playerId ? "ring-2 ring-white ring-offset-2 ring-offset-[#0a0e1a]" : ""}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                {p.isHost && <span className="text-amber-500 text-lg" title="Host">👑</span>}
                <div className="font-black text-white truncate text-lg">{p.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${p.isReady ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" : "bg-slate-600"}`} />
              <span className={`text-sm font-bold ${p.isReady ? "text-emerald-400" : "text-slate-500"}`}>
                {p.isReady ? "READY" : "NOT READY"}
              </span>
            </div>
          </div>
        ))}
        {/* Empty Slots */}
        {Array.from({ length: room.settings.maxPlayers - room.players.length }).map((_, i) => (
          <div key={`empty-${i}`} className="p-5 rounded-2xl bg-slate-900/30 border-2 border-dashed border-white/5 flex items-center justify-center">
            <span className="text-slate-600 font-bold text-sm tracking-widest">WAITING...</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="w-full max-w-md flex flex-col gap-4">
        {me && (
          <button
            onClick={handleToggleReady}
            className={`w-full py-4 rounded-xl font-black text-xl shadow-xl transition-all hover:scale-105 active:scale-95 ${
              me.isReady 
                ? "bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700" 
                : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-500/20"
            }`}
          >
            {me.isReady ? "CANCEL READY" : "I'M READY"}
          </button>
        )}

        {isHost && (
          <button
            onClick={handleStartDraft}
            disabled={(!allReady && room.players.length > 1)}
            className="w-full py-4 rounded-xl font-black text-xl bg-gradient-to-r from-indigo-600 to-blue-500 text-white shadow-xl shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100"
          >
            {room.players.length === 1 ? "START DRAFT (SOLO TEST)" : "START DRAFT"}
          </button>
        )}
      </div>
    </div>
  );
}
