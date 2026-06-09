import { TaskAssistantDashboard } from "./components/TaskAssistantDashboard";

export default function App() {
  return (
    <main className="min-h-screen bg-[#02050a] flex items-center justify-center p-2 sm:p-4 text-slate-100 selection:bg-emerald-500 selection:text-[#02050a] overflow-hidden">
      <TaskAssistantDashboard />
    </main>
  );
}

