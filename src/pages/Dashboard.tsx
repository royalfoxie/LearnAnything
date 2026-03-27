import { createSignal, onMount, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "@solidjs/router";

interface Course { id: any; name: string; material_id: string; }

export default function Dashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = createSignal<Course[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      setCourses(await invoke("list_courses"));
    } catch(e) { console.error(e); }
    setLoading(false);
  });

  function getRawId(thing: any) {
    if(!thing) return "";
    if(typeof thing === 'string') return thing;
    return thing.id?.String || thing.id || JSON.stringify(thing);
  }

  return (
    <div class="p-6 md:p-12 pb-32 max-w-7xl mx-auto h-full overflow-y-auto w-full animate-fade-in">
      <div class="text-left mb-12">
        <h2 class="text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight">Twoje Centrum Rozwoju</h2>
        <p class="text-slate-400 mt-3 text-lg">Wybierz kurs by wejść w Focus Mode, lub zainicjuj nowy profil z Doradcą AI.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
         {/* KAFEL DODAWANIA NOWEGO KURSU */}
         <button onClick={() => navigate('/builder')} class="p-6 glass-card rounded-2xl flex flex-col items-center justify-center text-center group hover:bg-violet-500/10 transition-all border-2 border-dashed border-slate-600 hover:border-violet-500/50 min-h-[220px]">
             <div class="w-16 h-16 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-violet-500 transition-all group-hover:text-white shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
             </div>
             <h4 class="text-xl font-bold text-slate-200">Twórz nowy kurs</h4>
             <p class="text-sm text-slate-400 mt-2">Prześlij PDF. AI wyręczy Cię w ekstrakcji i dopasowaniu ścieżki.</p>
         </button>

         {/* KAFELKI ISTNIEJACYCH KURSÓW */}
         <Show when={!loading()}>
             <For each={courses()}>{c => (
                 <button onClick={() => navigate(`/course/${getRawId(c.id).split(':').pop()}`)} class="p-6 glass-card rounded-2xl flex flex-col text-left group hover:bg-slate-800/80 transition-all border border-slate-700/30 hover:border-emerald-500/30 relative overflow-hidden min-h-[220px]">
                     <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/50 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     <div class="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-12 transition-all text-2xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">🎓</div>
                     <h4 class="text-lg font-semibold text-slate-100 leading-snug">{c.name}</h4>
                     <p class="text-xs font-mono text-slate-500 mt-auto pt-4 opacity-50 uppercase tracking-widest truncate w-full">ID: {getRawId(c.id).split(':').pop()}</p>
                 </button>
             )}</For>
         </Show>
         <Show when={loading()}>
            <div class="p-6 rounded-2xl flex flex-col items-center justify-center text-center border border-slate-700/30 min-h-[220px] animate-pulse bg-slate-800/20">
                <div class="w-14 h-14 rounded-full bg-slate-700/50 mb-4"></div>
                <div class="w-3/4 h-5 bg-slate-700/50 rounded mb-2"></div>
                <div class="w-1/2 h-3 bg-slate-700/30 rounded mt-auto"></div>
            </div>
         </Show>
      </div>
    </div>
  );
}
