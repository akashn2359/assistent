import React, { useState, useEffect, useRef } from "react";
import {
  Terminal as TerminalIcon,
  Cpu,
  Layers,
  Volume2,
  VolumeX,
  Sun,
  Battery,
  HardDrive,
  Lock,
  Moon,
  Power,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ExternalLink,
  Plus,
  Trash2,
  Mic,
  MicOff,
  Send,
  Check,
  CheckSquare,
  Square,
  Volume1,
  X,
  Minus,
  SquareTerminal,
  Pin,
  Settings,
  Activity,
  FileText,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Electron API window declaration
declare global {
  interface Window {
    electronAPI?: {
      runAction: (action: string, args?: string) => Promise<string>;
      launchApp: (targetApp: string, targetPath?: string) => Promise<boolean>;
      shutdownControl: (action: string) => Promise<boolean>;
      readTasksFile: () => Promise<any[]>;
      writeTasksFile: (tasks: any[]) => Promise<boolean>;
      openTasksInNotepad: () => Promise<boolean>;
      windowControl: (action: string) => void;
      onShortcutTriggered: (callback: () => void) => () => void;
      onStatsUpdated: (callback: (stats: any) => void) => () => void;
      startSpeech: () => Promise<{ success?: boolean; error?: string; details?: any }>;
      stopSpeech: () => Promise<{ success?: boolean; error?: string }>;
      getSpeechStatus: () => Promise<{ status: string; error: string | null }>;
      onSpeechStatus: (callback: (data: { status: string }) => void) => () => void;
      onSpeechRecognized: (callback: (text: string) => void) => () => void;
      onSpeechRejected: (callback: () => void) => () => void;
      onSpeechError: (callback: (error: string) => void) => () => void;
      agentCommand: (command: string) => Promise<{ success: boolean; output: string; commandExecuted?: string }>;
    };
  }
}

// Browser REST API fallback injection (Active only outside of Electron)
if (typeof window !== "undefined" && !navigator.userAgent.toLowerCase().includes("electron")) {
  let sse: EventSource | null = null;
  const statusListeners = new Set<(data: any) => void>();
  const recognizedListeners = new Set<(text: string) => void>();
  const rejectedListeners = new Set<() => void>();
  const errorListeners = new Set<(err: string) => void>();

  const initSSE = () => {
    if (sse) return;
    sse = new EventSource("/api/speech/events");
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "status") {
          statusListeners.forEach((l) => l(data));
        } else if (data.type === "recognized") {
          recognizedListeners.forEach((l) => l(data.text));
        } else if (data.type === "rejected") {
          rejectedListeners.forEach((l) => l());
        } else if (data.type === "error") {
          errorListeners.forEach((l) => l(data.message));
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };
    sse.onerror = () => {
      console.warn("SSE connection closed. Reconnecting...");
      sse?.close();
      sse = null;
      setTimeout(initSSE, 3000);
    };
  };

  initSSE();

  window.electronAPI = {
    runAction: async (action: string, args: string = ""): Promise<string> => {
      try {
        if (action === "SetVolume") {
          const vol = parseFloat(args.replace("-Value ", ""));
          const res = await fetch("/api/hardware/volume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ volume: vol })
          });
          return res.ok ? "Success" : "ERROR";
        }
        if (action === "SetMute") {
          const isMute = args.includes("$true");
          const res = await fetch("/api/hardware/volume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mute: isMute })
          });
          return res.ok ? "Success" : "ERROR";
        }
        if (action === "SetBrightness") {
          const bright = parseInt(args.replace("-Value ", ""), 10);
          const res = await fetch("/api/hardware/brightness", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brightness: bright })
          });
          return res.ok ? "Success" : "ERROR";
        }
        if (action === "SendMediaKey") {
          const res = await fetch("/api/media/command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: args })
          });
          return res.ok ? "Success" : "ERROR";
        }
        return "ERROR: Not implemented";
      } catch (err) {
        return "ERROR: " + err;
      }
    },
    launchApp: async (targetApp: string, targetPath: string = ""): Promise<boolean> => {
      try {
        const res = await fetch("/api/hardware/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app: targetApp, path: targetPath })
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    shutdownControl: async (action: string): Promise<boolean> => {
      try {
        const res = await fetch("/api/system/shutdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action })
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    readTasksFile: async (): Promise<any[]> => {
      try {
        const res = await fetch("/api/tasks");
        if (res.ok) {
          return await res.json();
        }
        return [];
      } catch {
        return [];
      }
    },
    writeTasksFile: async (tasks: any[]): Promise<boolean> => {
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks })
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    openTasksInNotepad: async (): Promise<boolean> => {
      try {
        const res = await fetch("/api/tasks/open", { method: "POST" });
        return res.ok;
      } catch {
        return false;
      }
    },
    windowControl: (action: string) => {
      console.warn(`Window control action [${action}] is not available in browser mode.`);
    },
    onShortcutTriggered: (callback: () => void) => {
      return () => {};
    },
    onStatsUpdated: (callback: (stats: any) => void) => {
      return () => {};
    },
    startSpeech: async () => {
      try {
        const res = await fetch("/api/speech/start", { method: "POST" });
        return res.ok ? { success: true } : { error: "Failed to start speech engine" };
      } catch (err: any) {
        return { error: err.message };
      }
    },
    stopSpeech: async () => {
      try {
        const res = await fetch("/api/speech/stop", { method: "POST" });
        return res.ok ? { success: true } : { error: "Failed to stop speech engine" };
      } catch (err: any) {
        return { error: err.message };
      }
    },
    getSpeechStatus: async () => {
      try {
        const res = await fetch("/api/speech/status");
        if (res.ok) return await res.json();
        return { status: "unknown", error: "Failed to load status" };
      } catch (err: any) {
        return { status: "unknown", error: err.message };
      }
    },
    onSpeechStatus: (callback: (data: { status: string }) => void) => {
      statusListeners.add(callback);
      return () => {
        statusListeners.delete(callback);
      };
    },
    onSpeechRecognized: (callback: (text: string) => void) => {
      recognizedListeners.add(callback);
      return () => {
        recognizedListeners.delete(callback);
      };
    },
    onSpeechRejected: (callback: () => void) => {
      rejectedListeners.add(callback);
      return () => {
        rejectedListeners.delete(callback);
      };
    },
    onSpeechError: (callback: (error: string) => void) => {
      errorListeners.add(callback);
      return () => {
        errorListeners.delete(callback);
      };
    },
    agentCommand: async (command: string) => {
      try {
        const res = await fetch("/api/agent/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command })
        });
        if (res.ok) return await res.json();
        throw new Error("REST API response failed");
      } catch (err: any) {
        return { success: false, output: err.message };
      }
    }
  };
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "input" | "output";
  message: string;
}

interface TaskItem {
  id: number;
  title: string;
  status: "pending" | "completed";
  created_at: string;
}

export const TaskAssistantDashboard: React.FC = () => {
  // Check environment mode
  const isElectron = typeof window !== "undefined" && navigator.userAgent.toLowerCase().includes("electron");

  // Logs & Commands
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "init",
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      type: "info",
      message: "SYSTEM TERMINAL CORE v4.0.0 INITIALIZED."
    },
    {
      id: "welcome",
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      type: "success",
      message: `VOICEPILOT ONLINE. Current Interface: ${isElectron ? "Electron Shell (Alt+A)" : "Chrome App Mode (Google STT Enabled)"}`
    },
    {
      id: "private",
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      type: "info",
      message: "SECURITY PROFILE: Private local loop. Hardware commands execute on native CPU."
    }
  ]);
  const [inputCommand, setInputCommand] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Speech engine modes
  const [speechEngineMode, setSpeechEngineMode] = useState<"local" | "browser">("local");
  const [speechEngineStatus, setSpeechEngineStatus] = useState<string>("initializing");
  const [speechEngineError, setSpeechEngineError] = useState<string | null>(null);

  // Audio visualizer state
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Live Telemetry
  const [telemetry, setTelemetry] = useState({
    cpu: 0,
    ram: 0,
    batteryLevel: 100,
    charging: true,
    diskCapacity: 0,
    volume: 50,
    brightness: 50
  });

  // Notepad Tasks
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // 1. Initialize stats/tasks on mount
  useEffect(() => {
    let statsInterval: NodeJS.Timeout | null = null;

    const initialize = async () => {
      // Load Tasks
      await loadTasks();

      if (isElectron && window.electronAPI) {
        // Listen for stats updates (Electron pushes stats via IPC)
        window.electronAPI.onStatsUpdated((stats) => {
          setTelemetry((prev) => ({
            ...prev,
            cpu: stats.cpu,
            ram: stats.ram,
            batteryLevel: stats.batteryLevel,
            charging: stats.charging,
            diskCapacity: stats.diskCapacity,
            volume: stats.volume !== undefined ? stats.volume : prev.volume,
            brightness: stats.brightness !== undefined && stats.brightness >= 0 ? stats.brightness : prev.brightness
          }));
        });

        // Listen for global shortcut Alt+A
        window.electronAPI.onShortcutTriggered(() => {
          addLog("Summoned via global shortcut [Alt+A].", "info");
          speak("Assistant active.");
          if (inputRef.current) {
            inputRef.current.focus();
          }
        });
      } else {
        // Browser mode fallback: poll Express REST API for system statistics
        const pollStats = async () => {
          try {
            const res = await fetch("/api/system/stats");
            if (res.ok) {
              const stats = await res.json();
              setTelemetry((prev) => ({
                ...prev,
                cpu: stats.cpu,
                ram: stats.ram,
                batteryLevel: stats.batteryLevel,
                charging: stats.charging,
                diskCapacity: stats.diskCapacity,
                volume: stats.volume !== undefined ? stats.volume : prev.volume,
                brightness: stats.brightness !== undefined && stats.brightness >= 0 ? stats.brightness : prev.brightness
              }));
            }
          } catch (err) {
            // Silence telemetry poll errors
          }
        };
        
        await pollStats();
        statsInterval = setInterval(pollStats, 3000);
      }
    };

    initialize();

    return () => {
      stopAudioAnalyzer();
      if (statsInterval) {
        clearInterval(statsInterval);
      }
    };
  }, []);

  // 2. Sync scroll bar for terminal logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // 3. Periodic Notepad task sync (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (window.electronAPI) {
        const fileTasks = await window.electronAPI.readTasksFile();
        if (JSON.stringify(fileTasks) !== JSON.stringify(tasks)) {
          setTasks(fileTasks);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [tasks]);

  // Logs helper
  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        timestamp: time,
        type,
        message
      }
    ]);
  };

  // Load Tasks from Notepad file
  const loadTasks = async () => {
    if (window.electronAPI) {
      const loaded = await window.electronAPI.readTasksFile();
      setTasks(loaded);
    }
  };

  // Save Tasks back to Notepad file
  const saveTasks = async (updatedTasks: TaskItem[]) => {
    if (window.electronAPI) {
      setTasks(updatedTasks);
      await window.electronAPI.writeTasksFile(updatedTasks);
    }
  };

  // Audio stream analyzer for mic visualization
  const setupAudioAnalyzer = (stream: MediaStream) => {
    try {
      stopAudioAnalyzer(); 
      
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
        setMicVolumeLevel(Math.min(average / 90, 1));
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setMicVolumeLevel(0);
  };

  // Text-To-Speech (TTS)
  const speak = (text: string) => {
    if (!speechEnabled) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = voices.find((v) => v.lang.startsWith("en")) || voices[0];
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Speech Recognition (Dual Engine: Local Offline & Browser Cloud)
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const startVoiceInput = async () => {
    // 1. Always prompt for microphone to animate visualizer
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setupAudioAnalyzer(stream);
    } catch (err: any) {
      console.warn("Visualizer mic access error:", err);
      // We will still try to start speech, but visualizer won't run.
      addLog(`Mic Visualizer Permission Denied: ${err.message}`, "warning");
    }

    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    if (speechEngineMode === "local") {
      // Use Local Offline Speech Recognition Engine
      if (!window.electronAPI) {
        addLog("Local speech interface not available.", "error");
        stopAudioAnalyzer();
        return;
      }
      
      addLog("Starting offline voice engine (native)...", "info");
      setIsListening(true);
      
      const res = await window.electronAPI.startSpeech();
      if (res && res.error) {
        addLog(`Offline Speech Engine failed to start: ${res.error}. Details: ${res.details || ""}`, "error");
        setIsListening(false);
        stopAudioAnalyzer();
      }
    } else {
      // Use Chrome Browser Cloud Speech Recognition Engine
      if (!SpeechRecognition) {
        addLog("Speech recognition not supported in this browser. Please use Google Chrome.", "error");
        stopAudioAnalyzer();
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
          addLog("Voice engine listening (cloud)...", "info");
        };

        recognition.onerror = (e: any) => {
          console.error("Speech Recognition Error:", e);
          setIsListening(false);
          stopAudioAnalyzer();
          
          if (e.error === "network") {
            addLog("Voice engine error: network. Note: Standalone Electron windows block Google Speech recognition. Please use 'Offline Local' mode for 100% private voice control.", "error");
            speak("Speech recognition network error. Please use offline local mode.");
          } else {
            addLog(`Voice engine error: ${e.error}`, "error");
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          stopAudioAnalyzer();
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          addLog(`User spoken: "${transcript}"`, "input");
          handleCommand(transcript);
        };

        recognition.start();
      } catch (err: any) {
        console.error("Browser mic access error:", err);
        addLog(`Speech Recognition failed: ${err.message}`, "error");
        setIsListening(false);
        stopAudioAnalyzer();
      }
    }
  };

  const stopVoiceInput = async () => {
    if (speechEngineMode === "local") {
      if (window.electronAPI) {
        await window.electronAPI.stopSpeech();
      }
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    }
    setIsListening(false);
    stopAudioAnalyzer();
  };

  // Helper to normalize text digits (e.g. "delete task one" -> "delete task 1")
  const normalizeSpokenNumbers = (text: string): string => {
    const wordNumbers: { [key: string]: string } = {
      one: "1", two: "2", three: "3", four: "4", five: "5",
      six: "6", seven: "7", eight: "8", nine: "9", ten: "10"
    };
    return text
      .split(/\s+/)
      .map((word) => wordNumbers[word.toLowerCase()] || word)
      .join(" ");
  };

  // Notepad Task Operations
  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newId = tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;
    const newTask: TaskItem = {
      id: newId,
      title: newTaskTitle.trim(),
      status: "pending",
      created_at: new Date().toISOString()
    };

    const updated = [...tasks, newTask];
    await saveTasks(updated);
    addLog(`Task appended to tasks.txt: "${newTask.title}"`, "success");
    speak(`Added task ${newTask.title}`);
    setNewTaskTitle("");
  };

  const toggleTask = async (id: number) => {
    const updated = tasks.map((t) => {
      if (t.id === id) {
        const nextStatus = t.status === "completed" ? "pending" : "completed";
        speak(`Task marked as ${nextStatus}`);
        return { ...t, status: nextStatus as "pending" | "completed" };
      }
      return t;
    });
    await saveTasks(updated);
    addLog(`Toggled status of task ID ${id}`, "info");
  };

  const deleteTask = async (id: number) => {
    const target = tasks.find((t) => t.id === id);
    const updated = tasks.filter((t) => t.id !== id);
    await saveTasks(updated);
    if (target) {
      addLog(`Deleted task: "${target.title}"`, "warning");
      speak(`Removed task ${target.title}`);
    }
  };

  const openNotepadFile = async () => {
    if (window.electronAPI) {
      await window.electronAPI.openTasksInNotepad();
      addLog("Opening tasks.txt in Notepad...", "info");
      speak("Opening tasks file in notepad");
    }
  };

  // Main Command Handler (100% Offline Logic)
  const handleCommand = async (rawCommand: string) => {
    if (!rawCommand.trim()) return;
    
    // Normalize punctuation and spoken numbers
    const cleanCommand = rawCommand.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    const normalizedCmd = normalizeSpokenNumbers(cleanCommand);
    const clean = normalizedCmd.toLowerCase().trim();

    addLog(`Processing command: "${normalizedCmd}"`, "info");

    if (!window.electronAPI) {
      addLog("Local server link missing.", "error");
      return;
    }

    setIsProcessing(true);

    // ==========================================
    // OFFLINE COMMAND MATCHERS (Zero Network)
    // ==========================================

    // 1. HELP / COMMANDS LIST
    if (clean === "help" || clean === "commands" || clean === "what can i say") {
      const helpText =
        "Supported commands:\n" +
        "• System Volume:\n" +
        "  - 'volume 50', 'volume to 80', 'mute', 'unmute'\n" +
        "  - 'volume up', 'volume down', 'louder', 'quieter'\n" +
        "• Screen Brightness:\n" +
        "  - 'brightness 60', 'brightness to 90'\n" +
        "  - 'brightness up', 'brightness down', 'brighter', 'dimmer'\n" +
        "• Task Files (tasks.txt):\n" +
        "  - 'add task buy milk', 'remind me to wash the car'\n" +
        "  - 'complete task 1', 'complete buy milk'\n" +
        "  - 'delete task 2', 'remove task buy milk'\n" +
        "  - 'read tasks', 'list tasks', 'open tasks file'\n" +
        "• Application Launchers:\n" +
        "  - 'open notepad', 'open calculator', 'open browser', 'open downloads'\n" +
        "• Hardware Media Buttons:\n" +
        "  - 'play', 'pause', 'play music', 'next song', 'skip', 'previous track'\n" +
        "• System Power Controls:\n" +
        "  - 'lock pc', 'sleep pc', 'shutdown pc', 'restart pc', 'abort shutdown'\n" +
        "• Hardware Telemetry:\n" +
        "  - 'system stats', 'telemetry', 'check status'";
      addLog(helpText, "info");
      speak("Displaying available offline commands.");
      setIsProcessing(false);
      return;
    }

    // 2. VOLUME CONTROLS
    if (clean === "mute" || clean === "silence") {
      await window.electronAPI.runAction("SetMute", "-MuteState $true");
      addLog("System muted successfully.", "success");
      speak("System muted.");
      setIsProcessing(false);
      return;
    }
    if (clean === "unmute" || clean === "unsilence") {
      await window.electronAPI.runAction("SetMute", "-MuteState $false");
      addLog("System unmuted successfully.", "success");
      speak("System unmuted.");
      setIsProcessing(false);
      return;
    }
    const volMatch = clean.match(/(?:set\s+)?volume\s+(?:to\s+)?(\d+)/) || clean.match(/^volume\s+(\d+)$/);
    if (volMatch) {
      const val = parseInt(volMatch[1], 10);
      if (val >= 0 && val <= 100) {
        await window.electronAPI.runAction("SetVolume", `-Value ${val}`);
        addLog(`System volume set to ${val}%.`, "success");
        speak(`Volume set to ${val} percent.`);
        setIsProcessing(false);
        return;
      }
    }
    if (clean === "volume up" || clean === "increase volume" || clean === "louder" || clean === "raise volume") {
      const nextVol = Math.min(telemetry.volume + 10, 100);
      await window.electronAPI.runAction("SetVolume", `-Value ${nextVol}`);
      addLog(`System volume increased to ${nextVol}%.`, "success");
      speak(`Volume ${nextVol} percent.`);
      setIsProcessing(false);
      return;
    }
    if (clean === "volume down" || clean === "decrease volume" || clean === "quieter" || clean === "lower volume") {
      const nextVol = Math.max(telemetry.volume - 10, 0);
      await window.electronAPI.runAction("SetVolume", `-Value ${nextVol}`);
      addLog(`System volume decreased to ${nextVol}%.`, "success");
      speak(`Volume ${nextVol} percent.`);
      setIsProcessing(false);
      return;
    }

    // 3. BRIGHTNESS CONTROLS
    const brightMatch = clean.match(/(?:set\s+)?brightness\s+(?:to\s+)?(\d+)/) || clean.match(/^brightness\s+(\d+)$/);
    if (brightMatch) {
      const val = parseInt(brightMatch[1], 10);
      if (val >= 0 && val <= 100) {
        await window.electronAPI.runAction("SetBrightness", `-Value ${val}`);
        addLog(`Screen brightness set to ${val}%.`, "success");
        speak(`Brightness set to ${val} percent.`);
        setIsProcessing(false);
        return;
      }
    }
    if (clean === "brightness up" || clean === "increase brightness" || clean === "brighter") {
      const nextBright = Math.min((telemetry.brightness >= 0 ? telemetry.brightness : 50) + 10, 100);
      await window.electronAPI.runAction("SetBrightness", `-Value ${nextBright}`);
      addLog(`Screen brightness increased to ${nextBright}%.`, "success");
      speak(`Brightness ${nextBright} percent.`);
      setIsProcessing(false);
      return;
    }
    if (clean === "brightness down" || clean === "decrease brightness" || clean === "dimmer") {
      const nextBright = Math.max((telemetry.brightness >= 0 ? telemetry.brightness : 50) - 10, 0);
      await window.electronAPI.runAction("SetBrightness", `-Value ${nextBright}`);
      addLog(`Screen brightness decreased to ${nextBright}%.`, "success");
      speak(`Brightness ${nextBright} percent.`);
      setIsProcessing(false);
      return;
    }

    // 4. APP LAUNCHERS
    if (clean === "open notepad" || clean === "launch notepad" || clean === "notepad") {
      await window.electronAPI.launchApp("notepad");
      addLog("Launching Notepad...", "success");
      speak("Opening Notepad.");
      setIsProcessing(false);
      return;
    }
    if (clean === "open calculator" || clean === "open calc" || clean === "launch calculator" || clean === "calculator" || clean === "calc") {
      await window.electronAPI.launchApp("calc");
      addLog("Launching Calculator...", "success");
      speak("Opening Calculator.");
      setIsProcessing(false);
      return;
    }
    if (clean === "open browser" || clean === "open chrome" || clean === "launch browser" || clean === "browser" || clean === "web") {
      await window.electronAPI.launchApp("browser", "https://google.com");
      addLog("Opening web browser...", "success");
      speak("Opening browser.");
      setIsProcessing(false);
      return;
    }
    if (clean === "open downloads" || clean === "downloads") {
      await window.electronAPI.launchApp("folder");
      addLog("Opening Downloads folder...", "success");
      speak("Opening Downloads.");
      setIsProcessing(false);
      return;
    }
    if (clean === "open tasks file" || clean === "edit tasks file" || clean === "open notepad tasks" || clean === "tasks file" || clean === "open tasks") {
      await openNotepadFile();
      setIsProcessing(false);
      return;
    }

    // 5. MEDIA CONTROLS
    if (
      clean === "play" ||
      clean === "pause" ||
      clean === "play music" ||
      clean === "pause music" ||
      clean === "toggle play" ||
      clean === "play/pause"
    ) {
      await window.electronAPI.runAction("SendMediaKey", "play_pause");
      addLog("Media Play/Pause command dispatched.", "success");
      speak("Toggled media.");
      setIsProcessing(false);
      return;
    }
    if (clean === "next" || clean === "next song" || clean === "skip song" || clean === "skip" || clean === "next track") {
      await window.electronAPI.runAction("SendMediaKey", "next");
      addLog("Media Next Track command dispatched.", "success");
      speak("Next track.");
      setIsProcessing(false);
      return;
    }
    if (clean === "previous" || clean === "prev song" || clean === "previous song" || clean === "go back" || clean === "prev track" || clean === "previous track") {
      await window.electronAPI.runAction("SendMediaKey", "previous");
      addLog("Media Previous Track command dispatched.", "success");
      speak("Previous track.");
      setIsProcessing(false);
      return;
    }

    // 6. SYSTEM POWER CONTROLS
    if (clean === "lock pc" || clean === "lock screen" || clean === "lock computer" || clean === "lock workstation" || clean === "lock") {
      addLog("Locking workstation...", "warning");
      speak("Locking screen.");
      await window.electronAPI.shutdownControl("lock");
      setIsProcessing(false);
      return;
    }
    if (clean === "sleep pc" || clean === "sleep computer" || clean === "put computer to sleep" || clean === "sleep") {
      addLog("Suspending workstation (sleep)...", "warning");
      speak("Putting computer to sleep.");
      await window.electronAPI.shutdownControl("sleep");
      setIsProcessing(false);
      return;
    }
    if (clean === "shutdown pc" || clean === "shutdown computer" || clean === "shutdown") {
      addLog("WARNING: System shutdown initiated! Scheduled in 15 seconds. Say 'abort shutdown' to cancel.", "error");
      speak("System shutdown initiated. Scheduled in fifteen seconds. Say abort shutdown to cancel.");
      await window.electronAPI.shutdownControl("shutdown");
      setIsProcessing(false);
      return;
    }
    if (clean === "restart pc" || clean === "restart computer" || clean === "restart" || clean === "reboot") {
      addLog("WARNING: System restart initiated! Scheduled in 15 seconds. Say 'abort shutdown' to cancel.", "error");
      speak("System restart initiated. Scheduled in fifteen seconds. Say abort shutdown to cancel.");
      await window.electronAPI.shutdownControl("restart");
      setIsProcessing(false);
      return;
    }
    if (clean === "abort shutdown" || clean === "cancel shutdown" || clean === "stop shutdown" || clean === "abort") {
      await window.electronAPI.shutdownControl("abort");
      addLog("System shutdown sequence cancelled.", "success");
      speak("Shutdown sequence aborted.");
      setIsProcessing(false);
      return;
    }

    // 7. TASK MANAGER CONTROLS (Voice Commands)
    
    // A. Add Task (Matches: "add task buy milk", "add todo read book", "remind me to wash the car")
    const taskAddMatch = 
      clean.match(/^add\s+(?:task|todo)\s+(.+)$/) || 
      clean.match(/^create\s+task\s+(.+)$/) ||
      clean.match(/^new\s+task\s+(.+)$/) ||
      clean.match(/^remind\s+me\s+to\s+(.+)$/) ||
      clean.match(/^add\s+(.+)\s+to\s+(?:my\s+)?tasks$/) ||
      clean.match(/^add\s+(.+)\s+to\s+(?:my\s+)?todo\s*list$/);

    if (taskAddMatch) {
      const title = taskAddMatch[1].trim();
      const newId = tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;
      const newTask: TaskItem = {
        id: newId,
        title: title,
        status: "pending",
        created_at: new Date().toISOString()
      };
      const updated = [...tasks, newTask];
      await saveTasks(updated);
      addLog(`Added task: "${title}"`, "success");
      speak(`Added task ${title}`);
      setIsProcessing(false);
      return;
    }

    // B. Complete/Check Task (Matches: "complete task 3", "complete buy milk")
    const completeMatch = clean.match(/^(?:complete|finish|check|checkoff)\s+(?:task|todo)?\s*(.+)$/);
    if (completeMatch) {
      const query = completeMatch[1].trim();
      const numId = parseInt(query, 10);
      
      if (!isNaN(numId)) {
        // Complete by numeric ID
        const target = tasks.find((t) => t.id === numId);
        if (target) {
          await toggleTask(numId);
          setIsProcessing(false);
          return;
        }
      } else {
        // Complete by text query title matching
        const matchedTask = tasks.find(
          (t) => t.status === "pending" && t.title.toLowerCase().includes(query)
        );
        if (matchedTask) {
          await toggleTask(matchedTask.id);
          setIsProcessing(false);
          return;
        }
      }
    }

    // C. Delete/Remove Task (Matches: "delete task 2", "remove task buy milk")
    const deleteMatch = clean.match(/^(?:delete|remove|clear|erase)\s+(?:task|todo)?\s*(.+)$/);
    if (deleteMatch) {
      const query = deleteMatch[1].trim();
      const numId = parseInt(query, 10);

      if (!isNaN(numId)) {
        // Delete by numeric ID
        const target = tasks.find((t) => t.id === numId);
        if (target) {
          await deleteTask(numId);
          setIsProcessing(false);
          return;
        }
      } else {
        // Delete by text query title matching
        const matchedTask = tasks.find((t) => t.title.toLowerCase().includes(query));
        if (matchedTask) {
          await deleteTask(matchedTask.id);
          setIsProcessing(false);
          return;
        }
      }
    }

    // D. Display/Read Tasks (Matches: "read tasks", "what are my tasks", "list tasks")
    if (
      clean.includes("read task") ||
      clean.includes("display task") ||
      clean.includes("show task") ||
      clean.includes("list task") ||
      clean.includes("read todo") ||
      clean.includes("list todo") ||
      clean === "what are my tasks" ||
      clean === "what is my tasks" ||
      clean === "tell me my tasks" ||
      clean === "display tasks" ||
      clean === "show tasks" ||
      clean === "show my tasks"
    ) {
      const pending = tasks.filter((t) => t.status === "pending");
      if (pending.length === 0) {
        const msg = "You have no pending tasks in your notepad file.";
        addLog(msg, "success");
        speak(msg);
      } else {
        const taskListStr = pending.map((t, idx) => `${idx + 1}. ${t.title}`).join(", ");
        const responseText = `You have ${pending.length} pending tasks: ${taskListStr}`;
        addLog(responseText, "success");
        speak(responseText);
      }
      setIsProcessing(false);
      return;
    }

    // 8. TELEMETRY RESOURCES CHECK
    if (
      clean === "check system resources" ||
      clean === "system stats" ||
      clean === "system status" ||
      clean === "check status" ||
      clean === "status" ||
      clean === "telemetry"
    ) {
      const statusText = `System telemetry: CPU is at ${telemetry.cpu}%, memory load is at ${telemetry.ram}%, and C-drive capacity is at ${telemetry.diskCapacity}% usage.`;
      addLog(statusText, "success");
      speak(statusText);
      setIsProcessing(false);
      return;
    }

    // Route unrecognized commands to the local AI Agent
    addLog(`Routing to AI Agent: "${normalizedCmd}"`, "info");

    try {
      let result: any = null;
      if (window.electronAPI && typeof window.electronAPI.agentCommand === "function") {
        result = await window.electronAPI.agentCommand(normalizedCmd);
      } else {
        const res = await fetch("/api/agent/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: normalizedCmd })
        });
        if (res.ok) {
          result = await res.json();
        }
      }

      if (result && !result.error) {
        if (result.thoughts) {
          addLog(`[AI THOUGHTS]: ${result.thoughts}`, "info");
        }
        if (result.logs && Array.isArray(result.logs)) {
          result.logs.forEach((logLine: string) => {
            addLog(`[AI EXECUTION]: ${logLine}`, "success");
          });
        }
        if (result.response) {
          addLog(result.response, "success");
          speak(result.response);
        }
        
        // Refresh the task list in case tasks were modified by the agent
        await loadTasks();
      } else {
        throw new Error(result?.error || "Invalid response from AI Agent");
      }
    } catch (err: any) {
      console.error("Agent execution failed:", err);
      const errMessage = err.message || "AI Agent offline or failed to execute.";
      addLog(`Failed to process command: "${normalizedCmd}". (Error: ${errMessage})`, "error");
      speak("Instruction not recognized.");
    }

    setIsProcessing(false);
  };

  // UI Window Actions
  const handleWindowAction = (action: string) => {
    if (window.electronAPI) {
      if (action === "toggle-always-on-top") {
        window.electronAPI.windowControl("toggle-always-on-top");
        setAlwaysOnTop(!alwaysOnTop);
        addLog(`Always on Top set to ${!alwaysOnTop ? "ON" : "OFF"}`, "info");
      } else {
        window.electronAPI.windowControl(action);
      }
    }
  };

  // 4. Background Speech Recognition engine event subscriptions
  useEffect(() => {
    if (!window.electronAPI) return;

    // Get initial status
    window.electronAPI.getSpeechStatus().then((info: any) => {
      if (info) {
        setSpeechEngineStatus(info.status);
        setSpeechEngineError(info.error);
      }
    }).catch(() => {});

    const unsubStatus = window.electronAPI.onSpeechStatus((data: any) => {
      if (data && data.status) {
        setSpeechEngineStatus(data.status);
      }
    });

    const unsubRecognized = window.electronAPI.onSpeechRecognized((text: string) => {
      addLog(`User spoken (offline): "${text}"`, "input");
      handleCommand(text);
    });

    const unsubRejected = window.electronAPI.onSpeechRejected(() => {
      addLog("Speech rejected: command not recognized.", "warning");
    });

    const unsubError = window.electronAPI.onSpeechError((err: string) => {
      setSpeechEngineError(err);
      addLog(`Voice engine error: ${err}`, "error");
    });

    return () => {
      unsubStatus();
      unsubRecognized();
      unsubRejected();
      unsubError();
    };
  }, []);

  // Keyboard Command Submit
  const onSubmitCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;
    const cmdText = inputCommand;
    addLog(`PILOT@SYSTEM:~$ ${cmdText}`, "input");
    handleCommand(cmdText);
    setInputCommand("");
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950/90 backdrop-blur-xl border border-emerald-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.15)] text-slate-100 font-mono select-none relative">
      
      {/* 1. Cyberpunk Title Bar (Draggable) */}
      <div 
        className="w-full h-11 flex items-center justify-between bg-slate-900/90 border-b border-emerald-500/20 px-4 shrink-0 relative z-10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-300 tracking-wider flex items-center gap-1.5">
            VOICEPILOT <span className="text-slate-500 font-normal">//</span> SYSTEM TERMINAL v4.0.0
          </span>
          <div className="flex items-center gap-1.5 ml-4 bg-slate-955 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[9px] text-emerald-400 font-bold uppercase">OFFLINE MODE</span>
          </div>
        </div>

        {/* Window controls (No drag) */}
        <div 
          className="flex items-center gap-1.5"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {/* Always on top toggle */}
          <button
            onClick={() => handleWindowAction("toggle-always-on-top")}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              alwaysOnTop 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" 
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            }`}
            title="Always on Top"
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          
          {/* Audio voice response toggle */}
          <button
            onClick={() => {
              setSpeechEnabled(!speechEnabled);
              addLog(`Voice feedback set to ${!speechEnabled ? "ENABLED" : "MUTED"}.`, "info");
            }}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              speechEnabled 
                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            }`}
            title="Toggle Voice Feedback"
          >
            {speechEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          <span className="w-px h-4 bg-slate-800 mx-1" />

          {/* Minimize */}
          <button
            onClick={() => handleWindowAction("minimize")}
            className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          {/* Maximize */}
          <button
            onClick={() => handleWindowAction("maximize")}
            className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <SquareTerminal className="w-3.5 h-3.5" />
          </button>
          {/* Close */}
          <button
            onClick={() => handleWindowAction("close")}
            className="p-1.5 rounded text-rose-500 hover:text-white hover:bg-rose-950/50 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Grid Workspace Layout */}
      <div className="flex-1 grid grid-cols-12 min-h-0 relative z-10">
        
        {/* ========================================== */}
        {/* LEFT COLUMN: Terminal Logs & Inputs (7/12) */}
        {/* ========================================== */}
        <div className="col-span-7 flex flex-col min-h-0 border-r border-emerald-500/10 bg-slate-950/45 p-4">
          
          {/* Scrolling Terminal Output */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-2.5 pr-2 font-mono text-xs select-text">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                <span className={`
                  ${log.type === "input" ? "text-cyan-400 font-bold" : ""}
                  ${log.type === "output" ? "text-indigo-300" : ""}
                  ${log.type === "success" ? "text-emerald-400 font-semibold" : ""}
                  ${log.type === "warning" ? "text-amber-400" : ""}
                  ${log.type === "error" ? "text-rose-400 font-bold" : ""}
                  ${log.type === "info" ? "text-slate-300" : ""}
                `}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>

          {/* Glowing Animated Circular Soundwave Visualizer */}
          <div className="h-24 flex items-center justify-center shrink-0 border-y border-emerald-500/10 mb-4 bg-slate-950/30 rounded-xl relative overflow-hidden">
            {/* Visualizer background lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

            <div className="flex items-center justify-center relative">
              <AnimatePresence>
                {/* Listening Glow rings that pulsate dynamically with user voice volume */}
                {isListening && (
                  <>
                    <motion.div
                      style={{
                        transform: `scale(${1.2 + micVolumeLevel * 1.5})`,
                        boxShadow: `0 0 ${20 + micVolumeLevel * 40}px rgba(16,185,129,${0.3 + micVolumeLevel * 0.7})`
                      }}
                      className="absolute w-12 h-12 rounded-full border-2 border-emerald-400 bg-emerald-400/5 transition-all duration-75"
                    />
                    <motion.div
                      style={{
                        transform: `scale(${1.0 + micVolumeLevel * 0.9})`
                      }}
                      className="absolute w-16 h-16 rounded-full border border-emerald-500 bg-emerald-500/5 transition-all duration-75"
                    />
                  </>
                )}

                {/* Speaking Wave rings */}
                {isSpeaking && (
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: [1, 1.25, 1] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -inset-4 rounded-full border border-indigo-400/40 bg-indigo-500/5 blur-sm"
                  />
                )}

                {/* Processing Ring */}
                {isProcessing && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="absolute -inset-3 rounded-full border-2 border-dashed border-indigo-500/40"
                  />
                )}
              </AnimatePresence>

              {/* Core Assistant Orb */}
              <button
                onClick={isListening ? stopVoiceInput : startVoiceInput}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 z-10 border cursor-pointer focus:outline-none ${
                  isListening
                    ? "bg-emerald-950 border-emerald-400 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                    : isSpeaking
                    ? "bg-indigo-950 border-indigo-400 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                    : isProcessing
                    ? "bg-slate-900 border-indigo-500 text-indigo-400 animate-pulse"
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-400 hover:shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                }`}
                title={isListening ? "Stop Listening" : "Start Voice command"}
              >
                {isListening ? (
                  <Mic className="w-5 h-5 text-emerald-400 animate-pulse" />
                ) : isSpeaking ? (
                  <Volume2 className="w-5 h-5 text-indigo-400" />
                ) : (
                  <MicOff className="w-5 h-5" />
                )}
              </button>

              <span className="absolute left-16 text-[10px] tracking-widest font-bold uppercase text-slate-500 w-32">
                {isListening ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    VOX ACTIVE <span className="text-[8px] opacity-75 font-mono">({Math.round(micVolumeLevel * 100)}%)</span>
                  </span>
                ) : isSpeaking ? (
                  <span className="text-indigo-400">VOX SPEAKING</span>
                ) : isProcessing ? (
                  <span className="text-indigo-400 animate-pulse">PROCESSING</span>
                ) : (
                  "VOX SLEEPING"
                )}
              </span>
            </div>
          </div>

          {/* Unified CommandLine Terminal Input */}
          <form onSubmit={onSubmitCommand} className="flex items-center gap-2 bg-slate-950 border border-emerald-500/20 rounded-lg px-3 py-2 shrink-0">
            <span className="text-emerald-400 font-bold select-none">PILOT@SYSTEM:~$</span>
            <div className="flex-1 flex items-center relative">
              <input
                ref={inputRef}
                type="text"
                value={inputCommand}
                onChange={(e) => setInputCommand(e.target.value)}
                placeholder="Enter command or tap the mic orb..."
                className="w-full bg-transparent border-none outline-none font-mono text-xs text-slate-100 placeholder-slate-600 focus:ring-0 p-0"
                autoFocus
              />
              {/* Blinking block terminal cursor animation when input is active */}
              {inputCommand === "" && (
                <div className="w-2 h-3.5 bg-emerald-400/80 animate-pulse ml-0.5 pointer-events-none absolute left-0" />
              )}
            </div>
            <button 
              type="submit" 
              className="p-1 rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* ========================================== */}
        {/* RIGHT COLUMN: Telemetry & Notepad Tasks (5/12) */}
        {/* ========================================== */}
        <div className="col-span-5 flex flex-col min-h-0 bg-slate-950/20 p-4 space-y-4 overflow-y-auto">
          
          {/* Widget 1: Telemetry Dashboard */}
          <div className="bg-slate-950/60 border border-emerald-500/10 rounded-xl p-3.5 animate-pulse-subtle">
            <div className="flex items-center gap-2 mb-3.5 border-b border-emerald-500/10 pb-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">SYSTEM TELEMETRY</span>
            </div>

            <div className="space-y-3">
              {/* CPU Usage */}
              <div>
                <div className="flex justify-between text-[10px] mb-1 font-mono text-slate-400">
                  <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-slate-500" /> CPU LOAD</span>
                  <span className={telemetry.cpu > 80 ? "text-rose-400 font-bold animate-pulse" : "text-emerald-400 font-bold"}>
                    {telemetry.cpu}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded overflow-hidden border border-slate-800">
                  <motion.div
                    className={`h-full ${telemetry.cpu > 80 ? "bg-rose-500" : "bg-emerald-400"}`}
                    animate={{ width: `${telemetry.cpu}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* RAM Usage */}
              <div>
                <div className="flex justify-between text-[10px] mb-1 font-mono text-slate-400">
                  <span className="flex items-center gap-1"><Layers className="w-3 h-3 text-slate-500" /> MEMORY LOAD</span>
                  <span className="text-emerald-400 font-bold">{telemetry.ram}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded overflow-hidden border border-slate-800">
                  <motion.div
                    className="h-full bg-emerald-400"
                    animate={{ width: `${telemetry.ram}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Volume & Brightness side by side */}
              <div className="grid grid-cols-2 gap-3">
                {/* Volume bar */}
                <div>
                  <div className="flex justify-between text-[10px] mb-1 font-mono text-slate-400">
                    <span className="flex items-center gap-1"><Volume1 className="w-3 h-3 text-slate-500" /> VOLUME</span>
                    <span className="text-emerald-400 font-mono">{telemetry.volume}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-900 rounded overflow-hidden border border-slate-850">
                    <div className="h-full bg-emerald-400" style={{ width: `${telemetry.volume}%` }} />
                  </div>
                </div>

                {/* Brightness bar */}
                <div>
                  <div className="flex justify-between text-[10px] mb-1 font-mono text-slate-400">
                    <span className="flex items-center gap-1"><Sun className="w-3 h-3 text-slate-500" /> BRIGHTNESS</span>
                    <span className="text-emerald-400 font-mono">
                      {telemetry.brightness >= 0 ? `${telemetry.brightness}%` : "N/A"}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-slate-900 rounded overflow-hidden border border-slate-850">
                    <div 
                      className="h-full bg-emerald-400" 
                      style={{ width: `${telemetry.brightness >= 0 ? telemetry.brightness : 0}%` }} 
                    />
                  </div>
                </div>
              </div>

              {/* Battery & Disk telemetry */}
              <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <Battery className="w-3.5 h-3.5" />
                  BATT: <strong className="text-slate-300">{telemetry.batteryLevel}% {telemetry.charging ? "(CHARGING)" : ""}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5" />
                  SYS DISK (C:): <strong className="text-slate-300">{telemetry.diskCapacity}% USED</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Widget: Voice Control Config & Diagnostics */}
          <div className="bg-slate-950/60 border border-emerald-500/10 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2.5 border-b border-emerald-500/10 pb-1.5">
              <div className="flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">VOICE CONTROL CONFIG</span>
              </div>
              <span className={`text-[8px] font-mono px-1 py-0.5 rounded uppercase border ${
                speechEngineStatus === "listening" ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/30 font-bold" :
                speechEngineStatus === "ready" ? "bg-blue-950/80 text-blue-400 border-blue-500/30" :
                speechEngineStatus === "initializing" ? "bg-amber-950/80 text-amber-400 border-amber-500/30 animate-pulse" :
                "bg-slate-900/80 text-slate-500 border-slate-800"
              }`}>
                {speechEngineStatus}
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Decoder mode selection */}
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500">VOX DECODER</span>
                <div className="flex bg-slate-900/60 rounded border border-slate-850 p-0.5">
                  <button
                    onClick={() => {
                      setSpeechEngineMode("local");
                      addLog("Decoder switched to Native Offline voice matching loop.", "info");
                      speak("Offline engine selected.");
                    }}
                    className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all cursor-pointer ${
                      speechEngineMode === "local"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    OFFLINE LOCAL
                  </button>
                  <button
                    onClick={() => {
                      setSpeechEngineMode("browser");
                      addLog("Decoder switched to Browser Cloud dictation API.", "info");
                      speak("Browser engine selected.");
                    }}
                    className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all cursor-pointer ${
                      speechEngineMode === "browser"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    BROWSER CLOUD
                  </button>
                </div>
              </div>

              {/* Status information & diagnostics */}
              <div className="bg-slate-950/80 rounded border border-slate-900 p-2 font-mono text-[9px] leading-normal text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Local Service:</span>
                  <span className={window.electronAPI ? "text-emerald-400" : "text-amber-500"}>
                    {window.electronAPI ? "CONNECTED" : "REST BACKEND ONLY"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Speech Feed:</span>
                  <span>{speechEngineMode === "local" ? "Native .NET SAPI" : "Chrome WebSpeech"}</span>
                </div>
                {speechEngineMode === "local" && speechEngineError && (
                  <div className="text-rose-450 border border-rose-950 bg-rose-950/15 px-1.5 py-1 rounded mt-1.5 break-words">
                    <strong>Error:</strong> {speechEngineError}
                  </div>
                )}
                {speechEngineMode === "local" && !speechEngineError && (
                  <div className="text-emerald-500/80 text-[8px] flex items-center gap-1 mt-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Offline speech matching loop active. Zero network calls.
                  </div>
                )}
                {speechEngineMode === "browser" && (
                  <div className="text-blue-400/80 text-[8px] flex items-center gap-1 mt-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Cloud-backed Web Speech API enabled (requires internet).
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Widget 2: Notepad Task Manager */}
          <div className="bg-slate-950/60 border border-emerald-500/10 rounded-xl p-3.5 flex-1 flex flex-col min-h-[200px]">
            <div className="flex items-center justify-between mb-3 border-b border-emerald-500/10 pb-1.5">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  NOTEPAD TASKS (tasks.txt)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={loadTasks}
                  className="p-1 rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-900 transition-colors cursor-pointer"
                  title="Reload Tasks"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                <button
                  onClick={openNotepadFile}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-bold hover:bg-indigo-500/20 hover:text-indigo-300 transition-all cursor-pointer"
                  title="Open text file in Notepad"
                >
                  <FolderOpen className="w-2.5 h-2.5" /> OPEN NOTEPAD
                </button>
              </div>
            </div>

            {/* Task Item List with Wrap Word styles instead of truncate */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs max-h-[160px]">
              {tasks.length === 0 ? (
                <div className="text-slate-600 text-[10px] text-center py-6">
                  No tasks loaded. Open in notepad to append tasks or write: "add task buy milk".
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between bg-slate-900/40 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 rounded px-2 py-1.5 transition-all group animate-fade-in"
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <button
                        onClick={() => toggleTask(task.id)}
                        className={`text-slate-500 hover:text-emerald-400 transition-colors shrink-0 mt-0.5 cursor-pointer`}
                      >
                        {task.status === "completed" ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 animate-pulse" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      
                      <span className={`whitespace-normal break-words leading-relaxed text-left flex-1 ${task.status === "completed" ? "line-through text-slate-600" : "text-slate-300"}`}>
                        <span className="text-slate-600 mr-1.5 font-bold">#{task.id}</span>
                        {task.title}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-slate-700 hover:text-rose-400 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Task quick form */}
            <form onSubmit={handleAddTask} className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-900">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Append new task to file..."
                className="flex-1 bg-slate-900/60 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-0"
              />
              <button
                type="submit"
                className="p-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Widget 3: Terminal Macros (Power & System Controls) */}
          <div className="bg-slate-950/60 border border-emerald-500/10 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2 border-b border-emerald-500/10 pb-1">
              <Power className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">TERMINAL MACROS</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 text-[9px] font-bold text-center">
              <button
                onClick={() => handleCommand("lock pc")}
                className="py-1 rounded bg-slate-900 text-slate-400 hover:bg-amber-950/40 hover:text-amber-400 border border-slate-850 hover:border-amber-500/30 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer"
              >
                <Lock className="w-3 h-3" /> LOCK
              </button>
              <button
                onClick={() => handleCommand("sleep pc")}
                className="py-1 rounded bg-slate-900 text-slate-400 hover:bg-indigo-950/40 hover:text-indigo-400 border border-slate-850 hover:border-indigo-500/30 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer"
              >
                <Moon className="w-3 h-3" /> SLEEP
              </button>
              <button
                onClick={() => handleCommand("shutdown pc")}
                className="py-1 rounded bg-slate-900 text-slate-400 hover:bg-rose-950/40 hover:text-rose-400 border border-slate-850 hover:border-rose-500/30 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer"
              >
                <Power className="w-3 h-3" /> SHUT
              </button>
              <button
                onClick={() => handleCommand("restart pc")}
                className="py-1 rounded bg-slate-900 text-slate-400 hover:bg-amber-950/40 hover:text-amber-400 border border-slate-850 hover:border-amber-500/30 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> RESTART
              </button>
              <button
                onClick={() => handleCommand("abort shutdown")}
                className="py-1 rounded bg-slate-900 text-rose-400 hover:bg-emerald-950/40 hover:text-emerald-400 border border-rose-500/20 hover:border-emerald-500/30 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" /> CANCEL
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Cyberpunk grid bottom frame overlay lines */}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500/50 via-indigo-500/50 to-emerald-500/50 opacity-40 pointer-events-none" />
    </div>
  );
};
