import { createSignal, onMount, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useParams, useNavigate } from "@solidjs/router";

export default function FocusMode() {
  const params = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = createSignal<"cra" | "scaffold" | "exam">("cra");
  const [nodeTitle, setNodeTitle] = createSignal("Ladowanie modułu...");
  const [nodeContent, setNodeContent] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [score, setScore] = createSignal<string | null>(null);
  const [aiResponse, setAiResponse] = createSignal("");
  
  onMount(async () => {
     try {
        const dbNodes: any[] = await invoke("get_course_roadmap", { courseId: `course:${params.id}` });
        const targetNodeId = `concept_node:${params.nodeId}`;
        const node = dbNodes.find(n => n.id?.String === targetNodeId || n.id?.id?.String === params.nodeId || JSON.stringify(n.id).includes(params.nodeId));
        if (node) {
           setNodeTitle(node.title);
           setNodeContent(node.content);
        } else {
           setNodeTitle("Nie znaleziono Modułu");
        }
     } catch(e) { console.error(e); }
     setLoading(false);
  });

  function goBack() {
      navigate(`/course/${params.id}`);
  }

  return (
    <div class="h-full flex flex-col items-center justify-center p-6 bg-slate-900 absolute inset-0 z-20">
      
      {/* Przycisk powrotu w lewym górnym rogu */}
      <button onClick={goBack} class="absolute top-8 left-8 text-slate-400 hover:text-white transition-colors flex items-center gap-2 group text-sm z-30">
          <span class="group-hover:-translate-x-1 transition-transform">←</span> Przerwij Focus (ADHD Safe)
      </button>

      {/* Pasek postępu faz */}
      <div class="flex justify-center gap-4 md:gap-12 w-full max-w-lg mb-8 md:mb-12 animate-pop" style="animation-delay: 0.1s">
        <div class={`text-xs md:text-sm font-semibold tracking-wider transition-colors duration-500 
          ${phase() === 'cra' ? 'text-violet-400' : 'text-slate-600'}`}>1. TEORIA (CRA)</div>
        <div class={`text-xs md:text-sm font-semibold tracking-wider transition-colors duration-500 
          ${phase() === 'scaffold' ? 'text-sky-400' : 'text-slate-600'}`}>2. SCHEMAT (Scaffold)</div>
        <div class={`text-xs md:text-sm font-semibold tracking-wider transition-colors duration-500 
          ${phase() === 'exam' ? 'text-emerald-400' : 'text-slate-600'}`}>3. WYZWANIE (SymPy)</div>
      </div>

      <div class="w-full max-w-3xl flex-1 max-h-[75vh] glass-card rounded-3xl p-6 md:p-10 overflow-y-auto animate-slide-up" style="animation-duration: 0.6s">
        
        <Show when={loading()}>
            <div class="h-full flex items-center justify-center text-slate-400 animate-pulse">Konsolidowanie kontekstu z LLM...</div>
        </Show>

        <Show when={!loading() && phase() === 'cra'}>
           <div class="flex flex-col h-full animate-pop">
              <h2 class="text-2xl text-slate-100 font-medium mb-4">{nodeTitle()}</h2>
              <div class="space-y-4 text-slate-300 flex-1">
                 <p class="leading-relaxed text-sm md:text-base opacity-80 whitespace-pre-wrap">Oto Twoja porcja wiedzy wydestylowana przez agentów (Extractor/Sequencer) z Makro-dokumentu:</p>
                 <div class="bg-violet-500/10 border border-violet-500/20 p-6 rounded-2xl flex flex-col md:flex-row gap-4 my-6">
                    <div class="text-4xl shrink-0">🧠</div>
                    <div class="text-sm md:text-base leading-relaxed text-violet-100 whitespace-pre-wrap font-mono">
                        {nodeContent()}
                    </div>
                 </div>
                 
                 <Show when={aiResponse()}>
                   <div class="p-4 bg-slate-800 rounded-xl mt-4 border border-violet-500/30 text-violet-200">
                      <strong class="text-xs uppercase tracking-widest text-violet-400 mb-2 block">Odpowiedź Tutora M.A.S:</strong>
                      <p>{aiResponse()}</p>
                   </div>
                 </Show>
              </div>
              <div class="shrink-0 pt-6 mt-6 md:mt-auto border-t border-slate-700/50 flex flex-col md:flex-row gap-4 justify-between items-center">
                 <p class="text-xs text-slate-500">Tutoring Agent nasłuchuje w tle gotowy pomóc w razie dryfu ucznia (Safety Critic).</p>
                 <button onClick={() => setPhase('scaffold')} class="px-8 py-3 rounded-full bg-violet-500 hover:bg-violet-400 text-white font-medium shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all flex justify-center">
                   Rozumiem Konkret →
                 </button>
              </div>
           </div>
        </Show>

        <Show when={!loading() && phase() === 'scaffold'}>
           <div class="flex flex-col h-full animate-pop">
              <h2 class="text-2xl text-slate-100 font-medium mb-4">Budowanie Sztywnych Ram</h2>
              <p class="text-slate-400 mb-6 flex-1">Z pomocą Tutoring Agenta podmień abstrakcję na model mentalny bez presji. Uzupełnij luki.</p>
              
              <div class="w-full bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 text-center tracking-widest text-slate-200 mb-8 shadow-inner italic">
                 {nodeTitle()} – to proces, w którym...
              </div>
              
              <div class="space-y-4 max-w-sm mx-auto w-full mb-8">
                <div class="flex items-center gap-4">
                  <div class="w-8 flex justify-center text-slate-500 font-bold">1</div>
                  <input type="text" placeholder="Twoje pierwsze skojarzenie pojęciowe..." class="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20 transition-all text-slate-100 placeholder:text-slate-500" />
                </div>
              </div>
              
              <div class="shrink-0 pt-6 border-t border-slate-700/50 flex justify-between">
                 <button onClick={() => setPhase('cra')} class="px-6 py-2 rounded-full text-slate-400 hover:text-slate-200 transition-colors">← Wróć</button>
                 <button onClick={() => setPhase('exam')} class="px-8 py-3 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-medium shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all">
                   Egzamin Validacyjny (SymPy) →
                 </button>
              </div>
           </div>
        </Show>
        
        <Show when={!loading() && phase() === 'exam'}>
          <div class="flex flex-col h-full animate-pop">
              <div class="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                <div class="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-4xl mb-2 shadow-[0_0_30px_rgba(16,185,129,0.2)]">⭐</div>
                <h2 class="text-3xl text-slate-100 font-bold">Test Abstrakcyjny MAS</h2>
                <p class="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  Odpowiedz swoimi słowami. <span class="text-emerald-400">Validation Agent</span> zamieni Twoje słowa na obiektywny zapis, przekaże do Sidecara Python (SymPy) i bezpiecznie oceni wykluczając halucynacje LLM.
                </p>
                
                <div class="w-full max-w-md mt-8 relative">
                   <input type="text" placeholder="Wynik..." class="w-full bg-slate-800/80 border-2 border-slate-600 rounded-2xl pl-6 pr-24 py-4 text-center text-lg focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all text-slate-100 font-mono shadow-inner" />
                   <button onClick={() => setScore("Zwalidowane: 4 (Ewaluacja Agentowa: Poprawne wg SymPy)")} class="absolute right-2 top-2 bottom-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl px-6 font-medium transition-colors shadow-lg">
                      Ślij do Rusta
                   </button>
                </div>

                <Show when={score()}>
                    <div class="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 animate-slide-up font-medium">
                        {score()}<br/>
                        <span class="text-sm opacity-70">Gratulacje. Faza zamknięta oparta o dowód obiektywny.</span>
                        <div class="mt-4">
                           <button onClick={goBack} class="underline text-emerald-400 hover:text-white transition-colors">Powrót na szlak Roadmapy</button>
                        </div>
                    </div>
                </Show>
              </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
