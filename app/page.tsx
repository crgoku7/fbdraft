import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      <main className="z-10 max-w-4xl w-full flex flex-col items-center text-center space-y-12">
        <div className="space-y-6">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Draft <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Football</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Experience the ultimate football management simulation. Draft your dream team, simulate seasons, and conquer the league.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 w-full max-w-3xl">
          <Link href="/database" className="group">
            <div className="glass-panel p-8 rounded-3xl h-full flex flex-col items-center text-center space-y-4 hover-lift border-2 border-transparent hover:border-blue-500/30 transition-all">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Player Database</h2>
              <p className="text-slate-500 dark:text-slate-400">
                Browse, search, and filter through the top 500 football players. Test the Core Data Layer (Milestone 1).
              </p>
            </div>
          </Link>

          <Link href="/draft" className="group">
            <div className="glass-panel p-8 rounded-3xl h-full flex flex-col items-center text-center space-y-4 hover-lift border-2 border-transparent hover:border-indigo-500/30 transition-all">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Single Player Draft</h2>
              <p className="text-slate-500 dark:text-slate-400">
                Draft against 7 AI managers to build your 11-man dream team. Test the Draft Engine (Milestone 2).
              </p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
