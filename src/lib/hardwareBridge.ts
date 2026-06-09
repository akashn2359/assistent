/**
 * Hardware Bridge
 * Handles communication with the local system Express server.
 * Gracefully falls back to simulated behavior if the local server is offline.
 */

export interface SystemStats {
  cpu: number;
  ram: number;
  batteryLevel: number;
  charging: boolean;
  diskCapacity: number;
}

export interface VolumeState {
  volume: number;
  mute: boolean;
}

let isBridgeOnline = false;

// Quick check to see if backend is available
export async function checkBridgeConnection(): Promise<boolean> {
  try {
    const res = await fetch("/api/system/stats");
    isBridgeOnline = res.ok;
    return res.ok;
  } catch {
    isBridgeOnline = false;
    return false;
  }
}

export function isConnectedToHost(): boolean {
  return isBridgeOnline;
}

// 1. Get system statistics (CPU, RAM, Battery, Disk)
export async function getSystemStats(): Promise<SystemStats | null> {
  try {
    const res = await fetch("/api/system/stats");
    if (!res.ok) throw new Error("Server responded with error");
    const data = await res.json();
    isBridgeOnline = true;
    return data;
  } catch (err) {
    isBridgeOnline = false;
    return null;
  }
}

// 2. Get hardware volume and mute state
export async function getVolumeState(): Promise<VolumeState | null> {
  try {
    const res = await fetch("/api/hardware/volume");
    if (!res.ok) throw new Error("Server responded with error");
    const data = await res.json();
    isBridgeOnline = true;
    return data;
  } catch (err) {
    isBridgeOnline = false;
    return null;
  }
}

// 3. Set hardware volume and/or mute state
export async function setVolumeState(volume?: number, mute?: boolean): Promise<VolumeState | null> {
  try {
    const res = await fetch("/api/hardware/volume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volume, mute })
    });
    if (!res.ok) throw new Error("Server responded with error");
    const data = await res.json();
    isBridgeOnline = true;
    return { volume: data.volume, mute: data.mute };
  } catch (err) {
    isBridgeOnline = false;
    return null;
  }
}

// 4. Get display brightness
export async function getBrightness(): Promise<number | null> {
  try {
    const res = await fetch("/api/hardware/brightness");
    if (!res.ok) throw new Error("Server responded with error");
    const data = await res.json();
    isBridgeOnline = true;
    return data.brightness;
  } catch (err) {
    isBridgeOnline = false;
    return null;
  }
}

// 5. Set display brightness
export async function setBrightness(brightness: number): Promise<boolean> {
  try {
    const res = await fetch("/api/hardware/brightness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brightness })
    });
    isBridgeOnline = res.ok;
    return res.ok;
  } catch {
    isBridgeOnline = false;
    return false;
  }
}

// 6. Launch applications or folders
export async function openApp(app: "browser" | "folder" | "notepad" | "calc", path?: string): Promise<boolean> {
  try {
    const res = await fetch("/api/hardware/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app, path })
    });
    isBridgeOnline = res.ok;
    return res.ok;
  } catch {
    isBridgeOnline = false;
    return false;
  }
}

// 7. System Shutdown / Abort
export async function shutdownSystem(abort?: boolean): Promise<boolean> {
  try {
    const res = await fetch("/api/system/shutdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ abort })
    });
    isBridgeOnline = res.ok;
    return res.ok;
  } catch {
    isBridgeOnline = false;
    return false;
  }
}

// 8. Media controls (play_pause, next, previous)
export async function sendMediaCommand(command: "play_pause" | "next" | "previous"): Promise<boolean> {
  try {
    const res = await fetch("/api/media/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command })
    });
    isBridgeOnline = res.ok;
    return res.ok;
  } catch {
    isBridgeOnline = false;
    return false;
  }
}
