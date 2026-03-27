import { createSignal, For, onMount, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import { invoke } from "@tauri-apps/api/core";

interface ConceptNode {
  id: any;
  course_id: string;
  title: string;
  content: string;
  status: "locked" | "current" | "completed";
  order_index: number;
}

export default function Roadmap() {
  const params = useParams();
  const navigate = useNavigate();
  const [nodes, setNodes] = createSignal<ConceptNode[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const dbNodes: ConceptNode[] = await invoke("get_course_roadmap", { courseId: `course:${params.id}` });
      setNodes(dbNodes);
    } catch(e) {
      console.error(e);
      alert("Nie udało się załadować mapy drogowego kursu.");
    } finally {
      setLoading(false);
    }
  });

  function getRawId(thing: any) {
    if(!thing) return "";
    if(typeof thing === 'string') return thing;
    return thing.id?.String || thing.id || JSON.stringify(thing);
  }

  function handleStartPhase(e: Event, nodeIdThing: any) {
     e.stopPropagation();
     const safeNodeId = getRawId(nodeIdThing).split(':').pop();
     navigate(`/course/${params.id}/focus/${safeNodeId}`);
  }

  return (
    <div class="h-full w-full overflow-y-auto p-4 md:p-8 relative">
      <div class="absolute w-[2px] h-full bg-slate-800/80 left-8 md:left-20 top-0 z-0"/>
      <div class="max-w-2xl mx-auto space-y-8 relative z-10 animate-pop">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Wygenerowany Szlak Wymogów (DAG)</h2>
          <p class="text-slate-400 mt-2">Dopasowany logiczny podgraf wiedzy ułożony chronologicznie.</p>
        </div>
        
        <Show when={loading()}>
           <div class="text-center text-slate-400 animate-pulse">Odpytywanie Bazy o ścieżkę...</div>
        </Show>

        <Show when={!loading() && nodes().length === 0}>
           <div class="text-center text-slate-500 bg-slate-800/20 p-8 rounded-2xl border border-slate-700">
              Agent Programowy (Curriculum) wciąż procesuje potok, lub nie ułożył żadnego Modułu. Odśwież za chwilę.
           </div>
        </Show>

        <For each={nodes()}>{(node, index) => (
          <div class="flex items-center gap-4 md:gap-6">
            <div class={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 
              ${node.status === 'completed' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50' : 
                node.status === 'current' ? 'bg-sky-500 shadow-[0_0_25px_rgba(14,165,233,0.4)] text-white' : 
                'bg-slate-800/50 text-slate-500 border border-slate-700/50'}`}>
              <span class="font-bold">{index() + 1}</span>
            </div>
            
            <div class={`flex-1 flex text-left items-start p-5 rounded-2xl glass-card transition-all
              ${node.status === 'locked' ? 'opacity-50' : 'hover:-translate-y-1'}`}>
              <div class="flex-1">
                <h3 class={`text-lg font-medium ${node.status === 'locked' ? 'text-slate-400' : 'text-slate-100'}`}>
                  {node.title}
                </h3>
                <p class="text-sm text-slate-400 mt-1">
                  {node.status === 'completed' ? "Zakończono pomyślnie" : node.status === 'current' ? "Moduł oczekuje w kolejce do wejścia w Focus" : "Zablokowane - wymaga zaliczenia wcześniejszych faz (Prerequisites)"}
                </p>
              </div>
              {node.status === 'current' && (
                <button onClick={(e) => handleStartPhase(e, node.id)} class="px-5 py-2 mt-2 sm:mt-0 rounded-full bg-sky-500 hover:bg-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.5)] text-white text-xs font-bold sm:ml-4 self-center uppercase tracking-wider transition-all border border-sky-400/50 group">
                  Skupienie <span class="group-hover:translate-x-1 inline-block transition-transform">→</span>
                </button>
              )}
            </div>
          </div>
        )}</For>
      </div>
    </div>
  );
}
