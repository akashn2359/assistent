import express from "express";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Resolve path to the helper powershell script
const scriptPath = path.join(__dirname, "system_control.ps1");

// Helper function to run a powershell action
async function runPowerShellAction(action: string, args: string = ""): Promise<string> {
  const command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -Action "${action}" ${args}`;
  const { stdout } = await execAsync(command);
  return stdout.trim();
}

// 1. Get system statistics (CPU, RAM, Battery, Disk)
app.get("/api/system/stats", async (req, res) => {
  try {
    const rawResult = await runPowerShellAction("GetStats");
    const parsed = JSON.parse(rawResult);
    res.json(parsed);
  } catch (error: any) {
    console.error("Error fetching system stats:", error.message);
    res.status(500).json({ error: "Failed to fetch system statistics", details: error.message });
  }
});

// 2. Get hardware volume and mute state
app.get("/api/hardware/volume", async (req, res) => {
  try {
    const volStr = await runPowerShellAction("GetVolume");
    const muteStr = await runPowerShellAction("GetMute");
    
    const volume = parseFloat(volStr);
    const mute = muteStr.toLowerCase() === "true";
    
    res.json({ volume: isNaN(volume) ? -1 : volume, mute });
  } catch (error: any) {
    console.error("Error fetching volume state:", error.message);
    res.status(500).json({ error: "Failed to fetch volume state", details: error.message });
  }
});

// 3. Set hardware volume and/or mute state
app.post("/api/hardware/volume", async (req, res) => {
  const { volume, mute } = req.body;
  
  try {
    if (volume !== undefined && typeof volume === "number") {
      await runPowerShellAction("SetVolume", `-Value ${volume}`);
    }
    
    if (mute !== undefined) {
      const muteArg = mute ? "$true" : "$false";
      await runPowerShellAction("SetMute", `-MuteState ${muteArg}`);
    }
    
    // Fetch and return the updated state
    const volStr = await runPowerShellAction("GetVolume");
    const muteStr = await runPowerShellAction("GetMute");
    
    res.json({
      success: true,
      volume: parseFloat(volStr),
      mute: muteStr.toLowerCase() === "true"
    });
  } catch (error: any) {
    console.error("Error setting volume state:", error.message);
    res.status(500).json({ error: "Failed to update volume state", details: error.message });
  }
});

// 4. Get display brightness
app.get("/api/hardware/brightness", async (req, res) => {
  try {
    const brightnessStr = await runPowerShellAction("GetBrightness");
    const brightness = parseInt(brightnessStr, 10);
    res.json({ brightness: isNaN(brightness) ? -1 : brightness });
  } catch (error: any) {
    console.error("Error fetching brightness:", error.message);
    res.status(500).json({ error: "Failed to fetch brightness", details: error.message });
  }
});

// 5. Set display brightness
app.post("/api/hardware/brightness", async (req, res) => {
  const { brightness } = req.body;
  if (brightness === undefined || typeof brightness !== "number") {
    return res.status(400).json({ error: "Brightness value is required and must be a number" });
  }
  
  try {
    await runPowerShellAction("SetBrightness", `-Value ${brightness}`);
    res.json({ success: true, brightness });
  } catch (error: any) {
    console.error("Error setting brightness:", error.message);
    res.status(500).json({ error: "Failed to update brightness", details: error.message });
  }
});

// 6. Launch applications or folders
app.post("/api/hardware/open", async (req, res) => {
  const { app: targetApp, path: targetPath } = req.body;
  
  try {
    let command = "";
    if (targetApp === "browser") {
      const url = targetPath || "https://google.com";
      command = `powershell -Command "Start-Process '${url}'"`;
    } else if (targetApp === "folder") {
      const folder = targetPath || path.join(process.env.USERPROFILE || "C:\\", "Downloads");
      command = `explorer.exe "${folder}"`;
    } else if (targetApp === "notepad") {
      command = "notepad.exe";
    } else if (targetApp === "calc") {
      command = "calc.exe";
    } else {
      return res.status(400).json({ error: "Unsupported target application" });
    }
    
    // Execute command detached to prevent blocking the node server
    exec(command, (err) => {
      if (err) console.error(`Error opening app ${targetApp}:`, err);
    });
    
    res.json({ success: true, message: `Dispatched launch instruction for ${targetApp}` });
  } catch (error: any) {
    console.error("Error executing launch app:", error.message);
    res.status(500).json({ error: "Failed to launch app", details: error.message });
  }
});

// 7. System Shutdown / Abort
app.post("/api/system/shutdown", async (req, res) => {
  const { abort } = req.body;
  
  try {
    let cmd = "shutdown /s /t 5"; // Shutdown in 5 seconds (matching UI timer trigger)
    if (abort) {
      cmd = "shutdown /a"; // Abort shutdown
    }
    
    await execAsync(cmd);
    res.json({ success: true, message: abort ? "Shutdown sequence aborted" : "Shutdown sequence initiated" });
  } catch (error: any) {
    console.error("Error in shutdown control:", error.message);
    res.status(500).json({ error: "Failed to run shutdown control", details: error.message });
  }
});

// 8. Media controls (play_pause, next, previous)
app.post("/api/media/command", async (req, res) => {
  const { command } = req.body;
  
  try {
    let keycode = "";
    if (command === "play_pause") keycode = "[char]179";
    else if (command === "next") keycode = "[char]176";
    else if (command === "previous") keycode = "[char]177";
    else return res.status(400).json({ error: "Invalid media command" });
    
    const psCmd = `powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys(${keycode})"`;
    await execAsync(psCmd);
    res.json({ success: true, command });
  } catch (error: any) {
    console.error("Error sending media key:", error.message);
    res.status(500).json({ error: "Failed to send media command", details: error.message });
  }
});

// Serve frontend build static files in production
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

app.get("*", (req, res, next) => {
  // If request starts with /api, pass it through to let it 404 or process, do not serve index.html
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      // In dev mode, we don't build, so send a simple message if they access index directly
      res.status(200).send("API server running. Frontend is available via dev server on port 3000.");
    }
  });
});

app.listen(PORT, () => {
  console.log(`Backend hardware management server executing on http://localhost:${PORT}`);
});
