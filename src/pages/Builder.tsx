import { createSignal, onMount, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate, A } from "@solidjs/router";
import { open } from "@tauri-apps/plugin-dialog";

type Step = "UPLOAD" | "CHAT" | "PROCESSING";
type SourceTab = "existing" | "new";

interface ChatMessage {
    role: "user" | "advisor";
    text: string;
}

export default function Builder() {
    const navigate = useNavigate();
    const [step, setStep] = createSignal<Step>("UPLOAD");
    const [courseName, setCourseName] = createSignal("");
    const [materialId, setMaterialId] = createSignal("");
    const [materialContent, setMaterialContent] = createSignal("");
    const [loadingPdf, setLoadingPdf] = createSignal(false);
    const [availableMaterials, setAvailableMaterials] = createSignal<any[]>([]);
    const [sourceTab, setSourceTab] = createSignal<SourceTab>("existing");

    onMount(async () => {
        try {
            const materials: any[] = await invoke("list_materials");
            const parsed = materials.map(m => {
                let strId = "";
                if (m.id?.String) strId = m.id.String;
                else if (m.id?.id?.String) strId = m.id.id.String;
                else {
                    const stringified = JSON.stringify(m.id);
                    const match = stringified.match(/"String":"([^"]+)"/);
                    if (match) strId = match[1];
                    else strId = stringified;
                }
                
                return {
                    rawId: m.id,
                    strId: strId.replace("material:", ""),
                    name: m.name || "Nieznany Materiał",
                    content: m.content || ""
                };
            });
            setAvailableMaterials(parsed);
            // Jeśli baza jest pusta, domyślnie pokaż tab "nowy"
            if (parsed.length === 0) setSourceTab("new");
        } catch (e) {
            console.error("Failed to load materials", e);
            setSourceTab("new");
        }
    });

    // Chat states
    const [chatHistory, setChatHistory] = createSignal<ChatMessage[]>([
        { role: "advisor", text: "Cześć! Widzę nowy materiał. Zanim zacznę ekstrakcję ułożoną pod Twoje skupienie, powiedz mi - jaki jest Twój główny cel i czy znasz już jakieś podstawy z tego tematu?" }
    ]);
    const [chatInput, setChatInput] = createSignal("");
    const [advisorThinking, setAdvisorThinking] = createSignal(false);
    let chatContainerRef: HTMLDivElement | undefined;

    function scrollToBottom() {
        if (chatContainerRef) {
            chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
        }
    }

    function validateCourseName(): boolean {
        if (!courseName().trim()) {
            alert("Podaj najpierw nazwę kursu.");
            return false;
        }
        return true;
    }

    async function handleFileSelect() {
        if (!validateCourseName()) return;

        try {
            const selected = await open({
                multiple: false,
                filters: [
                    { name: 'Dokumenty', extensions: ['pdf', 'docx', 'doc', 'pptx', 'html', 'htm', 'md', 'txt'] },
                    { name: 'Obrazy', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif'] },
                    { name: 'Wszystkie pliki', extensions: ['*'] }
                ]
            });
            
            if (selected) {
                setLoadingPdf(true);
                const id: string = await invoke("upload_pdf_material", { 
                    name: courseName() + " (Źródło)", 
                    path: selected 
                });
                setMaterialId(id);
                
                const materials: any[] = await invoke("list_materials");
                const mat = materials.find(m => (m.id?.String === id || m.id?.id?.String === id) || JSON.stringify(m.id).includes(id.replace("material:","")));
                if(mat) setMaterialContent(mat.content);

                setStep("CHAT");
                setTimeout(scrollToBottom, 100);
            }
        } catch (e) {
            console.error("handleFileSelect error:", e);
            alert("Nieudany import pliku: " + e);
        } finally {
            setLoadingPdf(false);
        }
    }

    function handleSelectExisting(mat: any) {
        if (!validateCourseName()) return;
        setMaterialId(mat.strId);
        setMaterialContent(mat.content);
        setStep("CHAT");
        setTimeout(scrollToBottom, 100);
    }

    async function sendChatMessage() {
        if (!chatInput().trim()) return;
        const inputStr = chatInput();
        setChatInput("");
        setChatHistory(prev => [...prev, { role: "user", text: inputStr }]);
        setAdvisorThinking(true);
        scrollToBottom();

        try {
            const historyStr = chatHistory().map(m => `${m.role.toUpperCase()}: ${m.text}`).join("\n");
            const response: string = await invoke("chat_with_advisor", { msg: historyStr });
            setChatHistory(prev => [...prev, { role: "advisor", text: response }]);
        } catch(e) {
            setChatHistory(prev => [...prev, { role: "advisor", text: "[Błąd systemu doradczego Agentów. Zgłoś poprawkę.]" }]);
        } finally {
            setAdvisorThinking(false);
            scrollToBottom();
        }
    }

    function formatMarkdown(text: string) {
        return text
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") // sanitize
            .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-emerald-300 font-bold">$1</strong>') // bold
            .replace(/\*([^*]+)\*/g, '<em class="text-emerald-200/80 italic">$1</em>') // italic
            .replace(/\n\n/g, '<div class="h-3"></div>') // paragraph spacing
            .replace(/\n- (.*)/g, '<div class="pl-4 relative"><span class="absolute left-0 text-emerald-500">•</span>$1</div>') // list items
            .replace(/\n([1-9]\.) (.*)/g, '<div class="pl-5 relative"><span class="absolute left-0 text-emerald-500 font-bold">$1</span>$2</div>') // numbered items
            .replace(/\n/g, '<br/>'); // basic newline
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    }

    async function buildCourse() {
        setStep("PROCESSING");
        try {
            const advisoryContext = chatHistory().map(m => `${m.role.toUpperCase()}: ${m.text}`).join("\n");
            
            if (!materialContent()) {
                alert("Brak przetworzonej treści dokumentu! Nie można ułożyć kursu.");
                setStep("CHAT");
                return;
            }

            const courseIdRaw: string = await invoke("create_course_pipeline", {
                name: courseName(),
                materialId: materialId(),
                materialContent: materialContent(),
                advisorContext: advisoryContext
            });
            const safeId = courseIdRaw.includes(":") ? courseIdRaw.split(":")[1] : courseIdRaw;
            navigate(`/course/${safeId}`);
        } catch(e) {
            alert("Wystąpił twardy błąd podczas procesowania kursu przez M.A.S:\n" + e);
            setStep("CHAT");
        }
    }

    return (
        <div class="h-full w-full bg-slate-900 flex flex-col items-center py-10 px-4 md:px-8 absolute inset-0 z-10 animate-fade-in overflow-y-auto">
            {/* Top bar */}
            <div class="w-full max-w-4xl fixed top-0 left-0 right-0 p-6 flex justify-between items-center bg-slate-900/80 backdrop-blur z-50">
               <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-slate-800 text-violet-400 flex items-center justify-center font-bold">L</div>
                  <h1 class="text-xl font-bold bg-gradient-to-r from-violet-300 to-sky-300 bg-clip-text text-transparent hidden sm:block">Laboratorium</h1>
               </div>
               <A href="/" class="text-sm font-medium text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700/50 py-2 px-4 rounded-full border border-slate-700/50">Wróć na Start</A>
            </div>

            <div class="w-full max-w-4xl flex-1 flex flex-col justify-center items-center mt-12 mb-12">

                {/* ═══════════════ KROK 1: Wybór Źródła ═══════════════ */}
                <Show when={step() === "UPLOAD"}>
                    <div class="glass-card p-10 md:p-14 rounded-3xl w-full text-center border-2 border-dashed border-slate-700 hover:border-violet-500/50 transition-all duration-500 max-w-2xl bg-slate-800/20 animate-pop relative overflow-hidden">
                        <div class="w-20 h-20 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto mb-8 shadow-inner shadow-violet-500/20">
                            <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </div>
                        
                        <h2 class="text-3xl font-bold text-slate-100 mb-4">Inicjalizacja Modułu</h2>
                        <p class="text-slate-400 mb-8 max-w-sm mx-auto">Nadaj nazwę kursowi i wybierz materiał źródłowy — z bazy lub z dysku.</p>

                        <div class="max-w-md mx-auto relative z-10">
                            {/* Nazwa kursu */}
                            <input 
                                type="text" 
                                placeholder="Nazwa kursu, np. Mechanika Kwantowa" 
                                value={courseName()} 
                                onInput={e => setCourseName(e.target.value)} 
                                class="w-full bg-slate-900 border-2 border-slate-700/80 rounded-2xl px-6 py-4 text-slate-100 text-center font-medium focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all placeholder:text-slate-600"
                            />

                            {/* Taby: Z Bazy / Nowy PDF */}
                            <div class="flex mt-8 mb-6 bg-slate-900/60 rounded-2xl p-1.5 border border-slate-700/50">
                                <button 
                                    onClick={() => setSourceTab("existing")}
                                    class={`flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${
                                        sourceTab() === "existing" 
                                            ? "bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-lg shadow-violet-500/10" 
                                            : "text-slate-500 hover:text-slate-300"
                                    }`}
                                >
                                    <span class="flex items-center justify-center gap-2">
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                                        Z bazy
                                    </span>
                                </button>
                                <button 
                                    onClick={() => setSourceTab("new")}
                                    class={`flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${
                                        sourceTab() === "new" 
                                            ? "bg-sky-600/20 text-sky-300 border border-sky-500/30 shadow-lg shadow-sky-500/10" 
                                            : "text-slate-500 hover:text-slate-300"
                                    }`}
                                >
                                    <span class="flex items-center justify-center gap-2">
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                                        Nowy plik
                                    </span>
                                </button>
                            </div>

                            {/* Panel: Z Bazy */}
                            <Show when={sourceTab() === "existing"}>
                                <div class="animate-fade-in">
                                    <Show when={availableMaterials().length > 0} fallback={
                                        <div class="py-12 text-center">
                                            <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                                                <svg class="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                                            </div>
                                            <p class="text-slate-500 text-sm">Brak materiałów w bazie.</p>
                                            <button onClick={() => setSourceTab("new")} class="mt-4 text-violet-400 hover:text-violet-300 text-sm font-medium underline underline-offset-4 transition-colors">
                                                Wgraj pierwszy plik →
                                            </button>
                                        </div>
                                    }>
                                        <div class="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-2" style="scrollbar-width: thin; scrollbar-color: rgba(139,92,246,0.3) transparent;">
                                            <For each={availableMaterials()}>{mat => (
                                                <button 
                                                    onClick={() => handleSelectExisting(mat)}
                                                    class="w-full relative py-4 px-5 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-violet-500/50 hover:bg-slate-800 transition-all text-left flex items-center group overflow-hidden"
                                                >
                                                    <div class="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                    <div class="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mr-4 shrink-0 group-hover:bg-violet-500/20 transition-colors">
                                                        <svg class="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                                    </div>
                                                    <div class="flex-1 min-w-0">
                                                        <span class="text-slate-200 font-medium truncate block">{mat.name}</span>
                                                        <span class="text-slate-500 text-xs">Gotowy do użycia</span>
                                                    </div>
                                                    <svg class="w-5 h-5 text-slate-600 group-hover:text-violet-400 transition-colors shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                                                </button>
                                            )}</For>
                                        </div>
                                    </Show>
                                </div>
                            </Show>

                            {/* Panel: Nowy PDF */}
                            <Show when={sourceTab() === "new"}>
                                <div class="animate-fade-in">
                                    <button 
                                        onClick={handleFileSelect} 
                                        disabled={loadingPdf()} 
                                        class="w-full py-5 rounded-2xl bg-gradient-to-r from-violet-600 to-sky-600 hover:from-violet-500 hover:to-sky-500 text-white font-bold tracking-wider shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_50px_rgba(139,92,246,0.4)] transition-all flex flex-col justify-center items-center disabled:opacity-50 gap-2"
                                    >
                                        <Show when={loadingPdf()} fallback={
                                            <>
                                                <svg class="w-8 h-8 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                                <span>Wybierz plik z dysku</span>
                                            </>
                                        }>
                                            <div class="flex items-center gap-3">
                                                <div class="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                                <span>Analiza pliku...</span>
                                            </div>
                                        </Show>
                                    </button>
                                    <p class="text-slate-600 text-xs mt-4 text-center">
                                        Plik zostanie przetworzony i zapisany w bazie do ponownego użytku.
                                    </p>
                                </div>
                            </Show>
                        </div>
                    </div>
                </Show>

                {/* ═══════════════ KROK 2: Chat z Advisorem ═══════════════ */}
                <Show when={step() === "CHAT"}>
                    <div class="w-full h-[75vh] glass-card rounded-3xl border border-slate-800/60 overflow-hidden flex flex-col shadow-2xl animate-slide-up relative z-10">
                        <div class="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 class="text-emerald-400 font-bold tracking-wider uppercase text-xs">Asystent Konfigurujący M.A.S</h3>
                                <p class="text-slate-400 text-sm mt-1">Doprecyzuj oczekiwania względem materiału <span class="text-slate-300 font-medium">"{courseName()}"</span></p>
                            </div>
                            <button onClick={buildCourse} class="px-5 py-2 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-full text-xs font-bold transition-all border border-emerald-500/30">Zakończ wywiad & Generuj</button>
                        </div>

                        <div class="flex-1 overflow-y-auto p-6 space-y-6" ref={chatContainerRef}>
                            <For each={chatHistory()}>{msg => (
                                <div class={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div class={`max-w-[85%] md:max-w-[75%] rounded-3xl px-6 py-4 text-sm md:text-base leading-relaxed ${
                                        msg.role === 'user' 
                                            ? 'bg-slate-700 text-white rounded-br-sm' 
                                            : 'bg-emerald-500/10 text-emerald-50 border border-emerald-500/20 rounded-bl-sm font-light'
                                    }`}>
                                        <Show when={msg.role === 'advisor'}><div class="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">Scope Advisor</div></Show>
                                        <div class="prose prose-invert prose-emerald prose-sm max-w-none leading-relaxed" innerHTML={formatMarkdown(msg.text)}>
                                        </div>
                                    </div>
                                </div>
                            )}</For>
                            <Show when={advisorThinking()}>
                                <div class="flex justify-start animate-fade-in">
                                    <div class="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl rounded-bl-sm px-6 py-4">
                                        <div class="flex gap-2.5 items-center h-4">
                                            <div class="w-2 h-2 rounded-full bg-emerald-500/40 animate-ping"></div>
                                            <div class="w-2 h-2 rounded-full bg-emerald-500/40 animate-ping" style="animation-delay: 0.2s"></div>
                                            <div class="w-2 h-2 rounded-full bg-emerald-500/40 animate-ping" style="animation-delay: 0.4s"></div>
                                        </div>
                                    </div>
                                </div>
                            </Show>
                        </div>

                        <div class="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                            <div class="relative max-w-3xl mx-auto flex items-end bg-slate-800/50 border border-slate-700 rounded-2xl p-2 transition-all focus-within:border-emerald-500/50">
                                <textarea 
                                    value={chatInput()} 
                                    onInput={e => setChatInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Napisz do doradcy..."
                                    class="w-full bg-transparent resize-none outline-none text-slate-100 placeholder:text-slate-500 px-4 py-3 min-h-[50px] max-h-[150px] overflow-y-auto"
                                    rows="1"
                                ></textarea>
                                <button 
                                    onClick={sendChatMessage} 
                                    disabled={!chatInput().trim() || advisorThinking()}
                                    class="p-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-xl m-1 transition-all disabled:opacity-50 shrink-0"
                                >
                                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                                </button>
                            </div>
                            <p class="text-center text-xs text-slate-600 mt-2 font-mono opacity-60">Wygenerowanie kursu wymaga zakończenia wywiadu przyciskiem u góry.</p>
                        </div>
                    </div>
                </Show>

                {/* ═══════════════ KROK 3: Przetwarzanie ═══════════════ */}
                <Show when={step() === "PROCESSING"}>
                    <div class="flex flex-col items-center justify-center p-12 text-center animate-slide-up">
                        <div class="w-24 h-24 mb-8 relative">
                            <div class="absolute inset-0 border-t-4 border-emerald-500 border-solid rounded-full animate-spin"></div>
                            <div class="absolute inset-0 border-r-4 border-violet-500 border-solid rounded-full animate-spin" style="animation-direction: reverse; animation-duration: 2s;"></div>
                            <div class="absolute inset-0 flex items-center justify-center text-2xl">🧠</div>
                        </div>
                        <h2 class="text-3xl font-bold underline decoration-emerald-500 decoration-wavy decoration-2 mb-4">Uruchomiono Kuratorów (MAS)</h2>
                        <p class="text-slate-400 max-w-md">Agents Extractor i Sequencer przeglądają bazę na podstawie wniosków z Twojego doradcy. Układamy DAG (Directed Acyclic Graph) węzłów dla Ciebie.</p>
                        <p class="text-xs text-slate-600 font-mono mt-8 p-3 bg-slate-800 rounded-lg">Proces może zająć do 60 sekund w zależności od API OpenRouter.</p>
                    </div>
                </Show>
            </div>
        </div>
    );
}
