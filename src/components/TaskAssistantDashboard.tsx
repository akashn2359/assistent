import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Mic, 
  MicOff, 
  Plus, 
  Trash2, 
  Search, 
  Check, 
  Calendar, 
  AlertCircle, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Send, 
  ListTodo, 
  HelpCircle,
  Clock,
  ChevronRight,
  TrendingUp,
  Activity,
  Bot
} from "lucide-react";
import { Task, VoiceSettings } from "../types";
import { parseNaturalLanguageDateTime } from "../lib/dateTimeParser";
import { motion, AnimatePresence } from "motion/react";

interface SpeechLog {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  timestamp: Date;
}

export const TaskAssistantDashboard: React.FC = () => {
  // State for Tasks
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem("voicepilot_tasks");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load tasks", e);
      }
    }
    // Fallback default tasks if empty
    return [
      {
        id: 1,
        title: "Welcome to VoiceTask Assistant",
        description: "Try speaking to me! Click the microphone and say: 'add task study math tomorrow at 4 PM'",
        priority: "high",
        status: "pending",
        created_at: new Date().toISOString(),
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        completed_at: null
      },
      {
        id: 2,
        title: "Review work reports",
        description: "Check the design documents before submitting",
        priority: "medium",
        status: "pending",
        created_at: new Date().toISOString(),
        due_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        completed_at: null
      }
    ];
  });

  // State for Voice Settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voiceURI: "",
    rate: 165,
    pitch: 1.0,
    volume: 1.0,
    offlineMode: true,
    wakeWordEnabled: false,
    wakeWord: "assistant",
    selectedMic: "default"
  });

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "createdAt">("dueDate");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);
  
  // Manual Task input state
  const [manualTitle, setManualTitle] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualPriority, setManualPriority] = useState<Task["priority"]>("medium");
  const [manualDueDate, setManualDueDate] = useState(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    tmrw.setHours(9, 0, 0, 0);
    return tmrw.toISOString().substring(0, 16);
  });

  // Speech Recognition & Speech Logs
  const [speechLogs, setSpeechLogs] = useState<SpeechLog[]>([
    {
      id: "initial",
      sender: "assistant",
      text: "Hello! I am your Voice Assistant. You can add tasks, complete them, or ask me to read them aloud by voice. Try clicking the microphone orb to begin.",
      timestamp: new Date()
    }
  ]);
  const [textCommand, setTextCommand] = useState("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Sync scroll to bottom of speech logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [speechLogs]);

  // Load SpeechSynthesis voices
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        if (voices.length > 0 && !voiceSettings.voiceURI) {
          const defaultVoice = voices.find(v => v.lang.startsWith("en")) || voices[0];
          setVoiceSettings(prev => ({ ...prev, voiceURI: defaultVoice.voiceURI }));
        }
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Save tasks to localStorage
  const saveTasks = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    localStorage.setItem("voicepilot_tasks", JSON.stringify(updatedTasks));
  };

  // Toast Helper
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Add Log Entry
  const addLog = (sender: "user" | "assistant" | "system", text: string) => {
    setSpeechLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender,
        text,
        timestamp: new Date()
      }
    ]);
  };

  // Web Speech Synthesis (TTS)
  const speak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      triggerToast("Text-to-speech not supported");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (voiceSettings.voiceURI) {
      const selected = availableVoices.find(v => v.voiceURI === voiceSettings.voiceURI);
      if (selected) utterance.voice = selected;
    }

    utterance.rate = voiceSettings.rate / 170; // Map range to logical speaking speed
    utterance.volume = voiceSettings.volume;
    utterance.pitch = voiceSettings.pitch;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Web Speech Recognition (STT) setup
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const startListening = async () => {
    if (!SpeechRecognition) {
      addLog("system", "Speech Recognition is not supported in this browser environment. You can type commands in the text bar.");
      triggerToast("Voice recognition not supported");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicPermissionGranted(true);
      
      // Setup audio analyzer for voice visualizer
      setupAudioAnalyzer(stream);

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      };

      recognition.onerror = (e: any) => {
        console.error("Speech Recognition Error:", e);
        setIsListening(false);
        stopAudioAnalyzer();
        if (e.error === "not-allowed") {
          setMicPermissionGranted(false);
          addLog("system", "Microphone permission denied. Please grant permission in your system settings.");
        } else {
          addLog("system", `Audio capture issue: ${e.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        stopAudioAnalyzer();
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        addLog("user", transcript);
        processCommand(transcript);
      };

      recognition.start();
    } catch (err) {
      console.error("Mic Access Error:", err);
      setMicPermissionGranted(false);
      addLog("system", "Cannot access microphone. Please ensure a mic is plugged in and permissions are granted.");
      triggerToast("Microphone access denied");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsListening(false);
    stopAudioAnalyzer();
  };

  // Setup AudioContext for real volume input visualization
  const setupAudioAnalyzer = (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        // Normalize
        setMicVolumeLevel(Math.min(average / 128, 1));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (e) {
      console.warn("Could not setup audio visualizer:", e);
    }
  };

  const stopAudioAnalyzer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setMicVolumeLevel(0);
  };

  // Toggle Microphone
  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Add Task manually via Form
  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) {
      triggerToast("Task title is required");
      return;
    }

    const newTask: Task = {
      id: tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
      title: manualTitle.trim(),
      description: manualDesc.trim(),
      priority: manualPriority,
      status: new Date(manualDueDate) < new Date() ? "overdue" : "pending",
      created_at: new Date().toISOString(),
      due_date: new Date(manualDueDate).toISOString(),
      completed_at: null
    };

    const updated = [...tasks, newTask];
    saveTasks(updated);
    addLog("system", `Created task #${newTask.id}: "${newTask.title}" manually`);
    triggerToast(`Task "${newTask.title}" added`);
    
    // Clear inputs
    setManualTitle("");
    setManualDesc("");
    setManualPriority("medium");
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    tmrw.setHours(9, 0, 0, 0);
    setManualDueDate(tmrw.toISOString().substring(0, 16));
  };

  // Delete Task
  const deleteTask = (id: number) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;
    
    const updated = tasks.filter(t => t.id !== id);
    saveTasks(updated);
    addLog("system", `Deleted task: "${taskToDelete.title}" (ID: ${id})`);
    triggerToast("Task deleted");
  };

  // Complete/Toggle Task Completion
  const toggleTaskComplete = (id: number) => {
    const updated = tasks.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === "completed" ? "pending" : "completed";
        return {
          ...t,
          status: nextStatus as any,
          completed_at: nextStatus === "completed" ? new Date().toISOString() : null
        };
      }
      return t;
    });
    saveTasks(updated);
    
    const item = updated.find(t => t.id === id);
    if (item) {
      addLog("system", `Marked task #${id} ("${item.title}") as ${item.status}`);
      speak(`Task ${item.title} marked as ${item.status === "completed" ? "completed" : "pending"}`);
    }
  };

  // Core Natural Language Voice Command Processor
  const processCommand = (query: string) => {
    const clean = query.trim().toLowerCase();
    
    // 1. Say/Read Tasks Aloud Command
    if (
      clean.includes("say my tasks") || 
      clean.includes("say tasks") || 
      clean.includes("read my tasks") || 
      clean.includes("read tasks") || 
      clean.includes("tell me my tasks") || 
      clean.includes("what are my tasks") || 
      clean.includes("list my tasks") || 
      clean.includes("list tasks")
    ) {
      const pending = tasks.filter(t => t.status !== "completed");
      if (pending.length === 0) {
        const msg = "You have no pending tasks in your list. Excellent work!";
        addLog("assistant", msg);
        speak(msg);
      } else {
        const taskSpokenList = pending.map((t, idx) => `${idx + 1}. ${t.title}`).join(", ");
        const responseText = `You have ${pending.length} pending tasks: ${taskSpokenList}`;
        addLog("assistant", responseText);
        speak(responseText);
      }
      return;
    }

    // 2. Add Task Voice Command
    // Matches: "add task buy milk tomorrow at 8 PM" or "create task review layout"
    const addPrefixes = ["add task ", "create task ", "new task ", "remind me to "];
    let matchedAddPrefix = addPrefixes.find(p => clean.startsWith(p));
    
    if (matchedAddPrefix) {
      const remaining = query.substring(matchedAddPrefix.length).trim();
      const datePhrases = ["tomorrow at", "next monday at", "next friday at", "friday at", "at ", "in "];
      
      let titlePart = remaining;
      let datePart = "";

      for (const phrase of datePhrases) {
        const index = remaining.toLowerCase().indexOf(phrase);
        if (index !== -1) {
          titlePart = remaining.substring(0, index).trim();
          datePart = remaining.substring(index).trim();
          break;
        }
      }

      // Trim trailing "at" if it got left behind
      if (titlePart.toLowerCase().endsWith(" at")) {
        titlePart = titlePart.substring(0, titlePart.length - 3).trim();
      }

      if (!titlePart) {
        const reply = "I heard the task creation command, but I couldn't find a task title. Try saying: 'add task buy groceries tomorrow at 5 PM'";
        addLog("assistant", reply);
        speak(reply);
        return;
      }

      const parsed = parseNaturalLanguageDateTime(datePart || "tomorrow");
      const nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
      
      const newTask: Task = {
        id: nextId,
        title: titlePart,
        description: `Added by voice command: "${query}"`,
        priority: "medium",
        status: parsed.dateTime < new Date() ? "overdue" : "pending",
        created_at: new Date().toISOString(),
        due_date: parsed.dateTime.toISOString(),
        completed_at: null
      };

      const updated = [...tasks, newTask];
      saveTasks(updated);
      
      const response = `Added task: "${newTask.title}", scheduled for ${parsed.dateTime.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      addLog("assistant", response);
      speak(response);
      triggerToast(`Voice task #${nextId} created`);
      return;
    }

    // 3. Complete Task Voice Command
    // Matches: "complete task 2", "finish task buy groceries", "mark task 1 as completed"
    if (
      clean.includes("complete task") || 
      clean.includes("finish task") || 
      clean.includes("mark task ")
    ) {
      // Try extracting an ID first
      const idMatch = clean.match(/(?:task|id)\s+(\d+)/) || clean.match(/(\d+)/);
      if (idMatch) {
        const id = parseInt(idMatch[1], 10);
        const task = tasks.find(t => t.id === id);
        if (task) {
          toggleTaskComplete(id);
          return;
        }
      }

      // Try matching by exact or partial title
      // E.g. "complete task buy milk" -> title query is "buy milk"
      let phraseToSearch = "";
      if (clean.includes("complete task ")) {
        phraseToSearch = clean.split("complete task ")[1];
      } else if (clean.includes("finish task ")) {
        phraseToSearch = clean.split("finish task ")[1];
      } else if (clean.includes("mark task ")) {
        phraseToSearch = clean.split("mark task ")[1].replace("as completed", "").replace("as complete", "").replace("completed", "").replace("complete", "").trim();
      }

      if (phraseToSearch) {
        const matchedTask = tasks.find(t => t.title.toLowerCase().includes(phraseToSearch));
        if (matchedTask) {
          toggleTaskComplete(matchedTask.id);
          return;
        }
      }

      const reply = "I couldn't identify which task to mark completed. Try specifying the task number or title, like: 'complete task 1'";
      addLog("assistant", reply);
      speak(reply);
      return;
    }

    // 4. Delete/Remove Task Voice Command
    // Matches: "delete task 1", "remove task study history"
    if (clean.includes("delete task") || clean.includes("remove task") || clean.includes("clear task")) {
      const idMatch = clean.match(/(?:task|id)\s+(\d+)/) || clean.match(/(\d+)/);
      if (idMatch) {
        const id = parseInt(idMatch[1], 10);
        const task = tasks.find(t => t.id === id);
        if (task) {
          deleteTask(id);
          speak(`Task ${id} has been removed.`);
          return;
        }
      }

      let phraseToSearch = "";
      if (clean.includes("delete task ")) {
        phraseToSearch = clean.split("delete task ")[1];
      } else if (clean.includes("remove task ")) {
        phraseToSearch = clean.split("remove task ")[1];
      } else if (clean.includes("clear task ")) {
        phraseToSearch = clean.split("clear task ")[1];
      }

      if (phraseToSearch) {
        const matchedTask = tasks.find(t => t.title.toLowerCase().includes(phraseToSearch));
        if (matchedTask) {
          deleteTask(matchedTask.id);
          speak(`Removed task: ${matchedTask.title}`);
          return;
        }
      }

      const reply = "I couldn't find the task to delete. Please specify the task number or title, like: 'delete task 2'";
      addLog("assistant", reply);
      speak(reply);
      return;
    }

    // 5. Remove completed tasks command
    if (clean.includes("remove completed tasks") || clean.includes("delete completed tasks") || clean.includes("clear completed tasks")) {
      const completedCount = tasks.filter(t => t.status === "completed").length;
      if (completedCount === 0) {
        const reply = "You have no completed tasks to remove.";
        addLog("assistant", reply);
        speak(reply);
      } else {
        const updated = tasks.filter(t => t.status !== "completed");
        saveTasks(updated);
        const reply = `Cleaned up task history. Purged ${completedCount} completed tasks.`;
        addLog("assistant", reply);
        speak(reply);
        triggerToast("Completed tasks cleared");
      }
      return;
    }

    // 6. Help Command
    if (clean === "help" || clean.includes("show commands") || clean.includes("what can i say")) {
      const reply = "You can say: 'add task buy milk', 'read tasks', 'complete task 1', or 'delete task 1'.";
      addLog("assistant", reply);
      speak(reply);
      return;
    }

    // Fallback error reply
    const fallbackReply = `I recognized your speech: "${query}", but I don't have a task action mapped for that phrase. Try saying "add task" or "say tasks".`;
    addLog("assistant", fallbackReply);
    speak("I did not recognize that command. Try add task or read tasks.");
  };

  // Submit Text Input command
  const handleTextCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textCommand.trim()) return;
    
    addLog("user", textCommand);
    processCommand(textCommand);
    setTextCommand("");
  };

  // Read single task title aloud (via TTS icon click)
  const speakSingleTask = (task: Task) => {
    speak(`Task ${task.id}: ${task.title}. Priority is ${task.priority}. Due date is ${new Date(task.due_date).toLocaleDateString()}. Status: ${task.status}.`);
  };

  // Filtered & Sorted Tasks list
  const processedTasks = useMemo(() => {
    const now = new Date();
    return tasks
      .filter(t => {
        // Search text match
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              t.description.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Status filter match
        let matchesStatus = true;
        if (statusFilter === "completed") {
          matchesStatus = t.status === "completed";
        } else if (statusFilter === "pending") {
          matchesStatus = t.status === "pending" || t.status === "overdue";
        }

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "dueDate") {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        } else if (sortBy === "priority") {
          const weights = { urgent: 4, high: 3, medium: 2, low: 1 };
          return weights[b.priority] - weights[a.priority];
        } else {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });
  }, [tasks, searchQuery, statusFilter, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const pending = tasks.filter(t => t.status === "pending").length;
    const overdue = tasks.filter(t => t.status === "overdue" || (t.status !== "completed" && new Date(t.due_date) < new Date())).length;
    return { total, completed, pending: pending + overdue, overdue };
  }, [tasks]);

  return (
    <div className="w-full max-w-6xl h-[700px] flex flex-col bg-[#070b13]/85 backdrop-blur-xl border border-slate-800/60 rounded-3xl overflow-hidden shadow-2xl relative font-sans">
      
      {/* Background ambient glowing decorations */}
      <div className="absolute top-[-100px] left-[-100px] w-96 h-96 rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[150px] pointer-events-none" />

      {/* Floating Status Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-6 right-6 z-50 bg-slate-900/90 border border-slate-700/80 text-slate-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-mono"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. Header Title Bar */}
      <header className="flex items-center justify-between border-b border-slate-800/60 px-6 py-4 shrink-0 bg-[#090f1a]/80 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 tracking-wide flex items-center gap-2">
              VoiceTask Pro
              <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded-full font-medium border border-slate-750">
                Desktop Assistant
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Local database active • Speech engine online</p>
          </div>
        </div>

        {/* Global Stats cards */}
        <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800/60 px-4 py-1.5 rounded-2xl">
          <div className="text-center px-2 border-r border-slate-800/80">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-500">Pending</span>
            <span className="text-xs font-mono font-bold text-emerald-400">{stats.pending}</span>
          </div>
          <div className="text-center px-2 border-r border-slate-800/80">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-500">Overdue</span>
            <span className="text-xs font-mono font-bold text-rose-400">{stats.overdue}</span>
          </div>
          <div className="text-center px-2">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-500">Completed</span>
            <span className="text-xs font-mono font-bold text-indigo-400">{stats.completed}</span>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 relative z-10">
        
        {/* ========================================== */}
        {/* LEFT COLUMN: Voice Control & Sandbox (5/12 cols) */}
        {/* ========================================== */}
        <section className="lg:col-span-5 border-r border-slate-800/60 p-5 flex flex-col min-h-0 bg-[#060a12]/40">
          
          {/* Section Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isListening ? "bg-emerald-500 animate-pulse" : isSpeaking ? "bg-indigo-500 animate-pulse" : "bg-slate-600"}`} />
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">
                {isListening ? "Listening Mode" : isSpeaking ? "Speaking Mode" : "Voice Control Hub"}
              </h2>
            </div>
            
            {/* Voice select settings */}
            <select
              value={voiceSettings.voiceURI}
              onChange={(e) => setVoiceSettings(p => ({ ...p, voiceURI: e.target.value }))}
              className="max-w-[150px] text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-1 rounded focus:outline-none"
              title="Voice Profile"
            >
              {availableVoices.length === 0 ? (
                <option>Default Voice</option>
              ) : (
                availableVoices.map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang.substring(0,2).toUpperCase()})</option>
                ))
              )}
            </select>
          </div>

          {/* Central Microphone Orb */}
          <div className="flex-1 flex flex-col items-center justify-center py-6 gap-3 shrink-0 select-none relative">
            <div className="relative">
              {/* Outer pulsing glow */}
              <AnimatePresence>
                {(isListening || isSpeaking) && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0.6 }}
                    animate={{ 
                      scale: isSpeaking ? [1.1, 1.25, 1.1] : [1.15, 1.35, 1.15],
                      opacity: [0.4, 0.1, 0.4]
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: isSpeaking ? 1.5 : 2.0, 
                      ease: "easeInOut" 
                    }}
                    className={`absolute -inset-6 rounded-full blur-xl ${
                      isSpeaking ? "bg-indigo-500/20" : "bg-emerald-500/20"
                    }`}
                  />
                )}
              </AnimatePresence>

              {/* Pulsing micro-waves inside the microphone area */}
              <button
                onClick={handleMicToggle}
                className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl relative z-10 border-4 cursor-pointer focus:outline-none ${
                  isListening
                    ? "bg-emerald-950/80 border-emerald-400 text-emerald-200 scale-105"
                    : isSpeaking
                    ? "bg-indigo-950/80 border-indigo-400 text-indigo-200 scale-102"
                    : "bg-slate-900/90 border-slate-800 text-slate-400 hover:bg-slate-850 hover:border-slate-650 hover:text-slate-200"
                }`}
                title={isListening ? "Click to stop listening" : "Click to start voice command"}
              >
                {isListening ? (
                  <Mic className="w-10 h-10 text-emerald-400 animate-pulse" />
                ) : isSpeaking ? (
                  <Volume2 className="w-10 h-10 text-indigo-400 animate-bounce" />
                ) : (
                  <MicOff className="w-10 h-10 text-slate-500" />
                )}
                <span className="text-[9px] font-mono mt-2 font-bold tracking-widest uppercase">
                  {isListening ? "Listening" : isSpeaking ? "Speaking" : "Click to Speak"}
                </span>
              </button>

              {/* Simulated microphone wave feedback bar */}
              {isListening && (
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 h-3">
                  {[...Array(5)].map((_, i) => {
                    const h = [12, 24, 16, 28, 8][i] * (0.3 + micVolumeLevel * 0.7);
                    return (
                      <span 
                        key={i} 
                        className="w-1 rounded-full bg-emerald-400 transition-all duration-75"
                        style={{ height: `${h}px` }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
            
            <p className="text-[10px] font-mono text-slate-500 text-center mt-3 max-w-[250px]">
              {isListening 
                ? "Listening... Speak task commands now." 
                : isSpeaking 
                ? "Reading task list aloud." 
                : "Push microphone to interact by voice."}
            </p>
          </div>

          {/* Transcript / Bot Logs Box */}
          <div className="h-44 border border-slate-800/60 bg-slate-950/50 rounded-2xl flex flex-col overflow-hidden mb-3">
            <div className="bg-[#0b101c] border-b border-slate-850 px-3 py-1.5 flex items-center justify-between shrink-0">
              <span className="text-[9px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                Dialogue Engine Console
              </span>
              <button 
                onClick={() => setSpeechLogs([{ id: "clr", sender: "system", text: "Console history reset.", timestamp: new Date() }])}
                className="text-[8px] font-mono text-slate-650 hover:text-slate-400 uppercase"
              >
                Flush Logs
              </button>
            </div>
            
            <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-2 text-[11px] font-mono">
              {speechLogs.map(log => {
                let badgeClass = "text-slate-500";
                let name = "SYSTEM";
                
                if (log.sender === "user") {
                  badgeClass = "text-emerald-400 font-bold";
                  name = "YOU";
                } else if (log.sender === "assistant") {
                  badgeClass = "text-indigo-400 font-bold";
                  name = "ASSISTANT";
                }

                return (
                  <div key={log.id} className="leading-relaxed border-b border-slate-900/40 pb-1.5 last:border-0">
                    <span className={`text-[9px] mr-1.5 uppercase select-none tracking-wider ${badgeClass}`}>
                      [{name}]
                    </span>
                    <span className={log.sender === "user" ? "text-slate-250 italic" : "text-slate-350"}>
                      {log.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Voice Triggers & Commands List */}
          <div className="bg-[#090e18]/80 border border-slate-850/80 rounded-2xl p-3 shrink-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Voice sandbox & phrases</span>
            </div>

            {/* Simulated preset command buttons */}
            <div className="grid grid-cols-2 gap-1.5 mb-2.5">
              <button
                onClick={() => {
                  addLog("user", "say my tasks");
                  processCommand("say my tasks");
                }}
                className="text-[9px] font-mono text-left bg-slate-900/60 hover:bg-[#0c1c24] hover:text-emerald-400 border border-slate-800 p-2 rounded-lg transition"
              >
                📢 "Say tasks"
              </button>
              <button
                onClick={() => {
                  const demoTask = "buy fresh milk today at 6 PM";
                  addLog("user", `add task ${demoTask}`);
                  processCommand(`add task ${demoTask}`);
                }}
                className="text-[9px] font-mono text-left bg-slate-900/60 hover:bg-[#0c1c24] hover:text-emerald-400 border border-slate-800 p-2 rounded-lg transition"
              >
                ➕ "Add task buy milk..."
              </button>
              <button
                onClick={() => {
                  const pending = tasks.filter(t => t.status !== "completed");
                  const demoId = pending.length > 0 ? pending[0].id : 1;
                  addLog("user", `complete task ${demoId}`);
                  processCommand(`complete task ${demoId}`);
                }}
                className="text-[9px] font-mono text-left bg-slate-900/60 hover:bg-[#0c1c24] hover:text-emerald-400 border border-slate-800 p-2 rounded-lg transition"
              >
                ✅ "Complete task..."
              </button>
              <button
                onClick={() => {
                  addLog("user", "remove completed tasks");
                  processCommand("remove completed tasks");
                }}
                className="text-[9px] font-mono text-left bg-slate-900/60 hover:bg-[#0c1c24] hover:text-emerald-400 border border-slate-800 p-2 rounded-lg transition"
              >
                🧹 "Clean completed"
              </button>
            </div>

            {/* Direct text keyboard command line */}
            <form onSubmit={handleTextCommandSubmit} className="flex gap-1.5 border-t border-slate-850/60 pt-2.5">
              <input
                type="text"
                placeholder="Type task command manually..."
                value={textCommand}
                onChange={(e) => setTextCommand(e.target.value)}
                className="flex-1 text-[11px] bg-[#05080e] border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-slate-300 placeholder-slate-650 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="bg-emerald-950 border border-emerald-800 hover:bg-emerald-900 text-emerald-300 px-3 hover:border-emerald-500 transition flex items-center justify-center rounded-lg cursor-pointer text-xs"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

        </section>

        {/* ========================================== */}
        {/* RIGHT COLUMN: Tasks Registry Board (7/12 cols) */}
        {/* ========================================== */}
        <section className="lg:col-span-7 p-5 flex flex-col min-h-0 bg-[#070b13]/20">
          
          {/* Top Panel Actions: Search, Filter tabs & Sort */}
          <div className="flex flex-col gap-3 pb-3 border-b border-slate-800/60 mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search task titles or descriptions..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#090f1a]/80 border border-slate-800 focus:border-emerald-500/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-350 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-400 px-2 py-1.5 focus:outline-none"
              >
                <option value="dueDate">Sort: Due Date</option>
                <option value="priority">Sort: Priority</option>
                <option value="createdAt">Sort: Created Time</option>
              </select>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-[#090f1d] p-1 rounded-lg border border-slate-850">
                {(["all", "pending", "completed"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3 py-1 rounded text-[10px] font-mono uppercase font-bold tracking-wider transition ${
                      statusFilter === tab 
                        ? "bg-emerald-950/60 text-emerald-450 border border-emerald-900/60" 
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Read Aloud All Pending Tasks Trigger */}
              <button
                onClick={() => processCommand("say tasks")}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-950/50 border border-indigo-900 hover:border-indigo-650 hover:bg-indigo-900/50 text-indigo-300 text-[10px] font-mono font-bold uppercase transition cursor-pointer"
                title="Speak all tasks"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Read tasks aloud
              </button>
            </div>
          </div>

          {/* Task manual form drawer (collapsible/inline) */}
          <div className="mb-4 bg-[#0a0f1d]/75 border border-slate-850/80 rounded-2xl p-3.5 shrink-0">
            <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono mb-2">
              ➕ Add Task UI Form
            </span>
            <form onSubmit={handleManualAdd} className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs">
              <div className="md:col-span-4">
                <input
                  type="text"
                  placeholder="Task title *"
                  value={manualTitle}
                  onChange={e => setManualTitle(e.target.value)}
                  className="w-full bg-[#06090f] border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div className="md:col-span-3">
                <select
                  value={manualPriority}
                  onChange={e => setManualPriority(e.target.value as any)}
                  className="w-full bg-[#06090f] border border-slate-800 rounded-lg px-2 py-1.5 text-slate-400 focus:outline-none focus:border-emerald-500"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent Priority</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <input
                  type="datetime-local"
                  value={manualDueDate}
                  onChange={e => setManualDueDate(e.target.value)}
                  className="w-full bg-[#06090f] border border-slate-800 rounded-lg px-2 py-1 text-slate-400 focus:outline-none text-[11px]"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 hover:border-emerald-500 text-emerald-300 font-mono uppercase tracking-wider font-bold py-1.5 rounded-lg transition cursor-pointer text-[10px]"
                >
                  Create
                </button>
              </div>
            </form>
          </div>

          {/* Scrollable Tasks Container */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1.5 min-h-0">
            {processedTasks.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-650 italic text-xs font-mono text-center">
                <ListTodo className="w-10 h-10 text-slate-800/80 mb-2 animate-pulse" />
                <span>No tasks matching the current filters.</span>
                <span className="text-[10px] text-slate-700 mt-1">Say "add task [task name]" to insert one.</span>
              </div>
            ) : (
              processedTasks.map(task => {
                const isOverdue = task.status !== "completed" && new Date(task.due_date) < new Date();
                
                // Color mapping for priorities
                let priorityClass = "bg-slate-900/60 border-slate-800 text-slate-500";
                if (task.priority === "urgent") priorityClass = "bg-rose-950/40 border-rose-900/60 text-rose-400";
                else if (task.priority === "high") priorityClass = "bg-amber-950/40 border-amber-900/60 text-amber-400";
                else if (task.priority === "medium") priorityClass = "bg-indigo-950/40 border-indigo-900/60 text-indigo-400";
                else if (task.priority === "low") priorityClass = "bg-emerald-950/40 border-emerald-900/60 text-emerald-400";

                return (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3 bg-[#080d15]/60 border rounded-2xl transition-all duration-200 group ${
                      task.status === "completed"
                        ? "border-slate-900/80 bg-slate-950/20 opacity-60 scale-[0.99]"
                        : isOverdue
                        ? "border-rose-950/60 bg-rose-950/5"
                        : "border-slate-800 hover:border-slate-700 hover:bg-[#0c1221]/50"
                    }`}
                  >
                    {/* Circle Checkbox */}
                    <button
                      onClick={() => toggleTaskComplete(task.id)}
                      className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition cursor-pointer shrink-0 ${
                        task.status === "completed"
                          ? "bg-indigo-950/80 border-indigo-500 text-indigo-400"
                          : isOverdue
                          ? "border-rose-800 hover:border-rose-600 bg-slate-950/40"
                          : "border-slate-850 hover:border-slate-600 bg-slate-950/40 text-transparent hover:text-slate-500"
                      }`}
                      title={task.status === "completed" ? "Mark pending" : "Mark completed"}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[9px] text-slate-600 font-bold">
                          #{task.id}
                        </span>
                        
                        <h4 className={`text-xs font-semibold leading-snug truncate ${
                          task.status === "completed" ? "text-slate-500 line-through font-normal" : "text-slate-200"
                        }`}>
                          {task.title}
                        </h4>

                        {/* Priority Badge */}
                        <span className={`text-[8px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded border select-none shrink-0 ${priorityClass}`}>
                          {task.priority}
                        </span>
                      </div>

                      {task.description && (
                        <p className={`text-[10px] mt-1 line-clamp-2 leading-relaxed ${
                          task.status === "completed" ? "text-slate-650" : "text-slate-450"
                        }`}>
                          {task.description}
                        </p>
                      )}

                      {/* Footer Info */}
                      <div className="flex flex-wrap items-center gap-3.5 mt-2 text-[9px] font-mono text-slate-500">
                        <span className="flex items-center gap-1 shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-slate-600" />
                          Due: <span className={isOverdue ? "text-rose-450 font-bold" : "text-slate-400"}>
                            {new Date(task.due_date).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </span>

                        {task.status === "completed" && task.completed_at && (
                          <span className="text-indigo-400 shrink-0 font-medium">
                            Done: {new Date(task.completed_at).toLocaleDateString()}
                          </span>
                        )}

                        {isOverdue && (
                          <span className="text-rose-450 font-bold flex items-center gap-0.5 uppercase tracking-wider text-[8px] border border-rose-950 bg-rose-950/20 px-1 rounded select-none shrink-0">
                            <AlertCircle className="w-2.5 h-2.5 animate-pulse" /> OVERDUE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick action buttons on hover */}
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-150 shrink-0 self-center">
                      
                      {/* Speak this single task */}
                      <button
                        onClick={() => speakSingleTask(task)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-700 text-slate-450 hover:text-indigo-400 cursor-pointer transition"
                        title="Read task info aloud"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-900 text-slate-450 hover:text-rose-450 cursor-pointer transition"
                        title="Delete task permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </section>

      </div>

    </div>
  );
};
