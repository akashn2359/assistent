export interface Command {
  id: string;
  phrase: string;
  description: string;
  category: "core" | "system" | "automation";
  actionType: "text" | "time" | "date" | "stop" | "exit" | "volume_up" | "volume_down" | "volume_mute" | "app_browser" | "app_folder" | "shutdown" | "abort" | "cpu_usage" | "memory_usage" | "battery_status" | "disk_space" | "open_notepad" | "open_calc" | "media_play_pause" | "media_next" | "media_prev" | "brightness_up" | "brightness_down";
  response: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "input" | "output";
  source: "system" | "voice-in" | "voice-out" | "engine" | "automation";
  message: string;
}

export interface VoiceSettings {
  voiceURI: string;
  rate: number;
  pitch: number;
  volume: number;
  offlineMode: boolean;
  wakeWordEnabled: boolean;
  wakeWord: string;
  selectedMic: string;
}

export interface SourceFile {
  path: string;
  name: string;
  content: string;
  language: string;
  description: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "completed" | "overdue";
  created_at: string;
  due_date: string;
  completed_at: string | null;
}

export interface Reminder {
  id: number;
  message: string;
  reminder_time: string;
  repeat_type: "none" | "daily" | "weekly" | "monthly";
  triggered: boolean;
  created_at: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
  created_at: string;
}

