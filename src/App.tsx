import { lazy, Suspense, Show } from "solid-js";
import { Router, Route, A, useLocation } from "@solidjs/router";
import "./App.css";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Builder = lazy(() => import("./pages/Builder"));
const Roadmap = lazy(() => import("./pages/Roadmap"));
const FocusMode = lazy(() => import("./pages/FocusMode"));

const Layout = (props: any) => {
  const location = useLocation();
  return (
  <div class="h-screen w-full bg-slate-900 text-slate-100 font-sans selection:bg-violet-500/30 selection:text-white overflow-hidden flex flex-col">
    {/* Navigation Bar / Header - Fixed height */}
    <header class="h-16 shrink-0 border-b border-white/5 glass z-50 flex items-center px-6 justify-between animate-slide-up" style="animation-duration: 0.3s">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-sky-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span class="font-bold text-white text-sm">L</span>
          </div>
          <h1 class="text-xl font-bold tracking-tight bg-gradient-to-r from-violet-300 to-sky-300 bg-clip-text text-transparent">LearningPath MAS</h1>
        </div>
        <nav class="flex space-x-6">
          <Show when={location.pathname !== "/" && location.pathname !== "/builder"}>
            <A href="/" class="text-sm font-medium text-slate-400 hover:text-violet-300 transition-colors">Wróć na Start (Hub)</A>
          </Show>
        </nav>
    </header>

    {/* Content Area - Scrollable */}
    <main class="flex-1 w-full overflow-hidden relative pb-4">
      <Suspense fallback={<div class="p-8 text-slate-400 text-center mt-10">Wczytywanie dynamicznego widoku Agenta...</div>}>
        {props.children}
      </Suspense>
    </main>
  </div>
  );
};

function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={Dashboard} />
      <Route path="/builder" component={Builder} />
      <Route path="/course/:id" component={Roadmap} />
      <Route path="/course/:id/focus/:nodeId" component={FocusMode} />
    </Router>
  );
}

export default App;
