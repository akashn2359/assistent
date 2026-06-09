import { TaskAssistantDashboard } from "./components/TaskAssistantDashboard";

export default function App() {
  return (
    <main className="w-screen h-screen bg-[#02050a] flex items-center justify-center text-slate-100 selection:bg-emerald-500 selection:text-[#02050a] overflow-hidden p-0 m-0">
      <TaskAssistantDashboard />
    </main>
  );
}

