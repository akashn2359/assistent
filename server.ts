import express from "express";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import fs from "fs";

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
    
    // Fetch volume and brightness in the same polling call
    const volStr = await runPowerShellAction("GetVolume");
    const brightStr = await runPowerShellAction("GetBrightness");
    
    parsed.volume = parseFloat(volStr);
    parsed.brightness = parseInt(brightStr, 10);
    
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

// 7. System Power Controls (Shutdown, Restart, Abort, Lock, Sleep)
app.post("/api/system/shutdown", async (req, res) => {
  const { action } = req.body;
  
  try {
    let command = "";
    if (action === "shutdown") {
      await showToastNotification("System Shutdown Initiated", "Shutdown sequence scheduled in 15 seconds.");
      command = "shutdown /s /t 15";
    } else if (action === "restart") {
      await showToastNotification("System Restart Initiated", "Restart sequence scheduled in 15 seconds.");
      command = "shutdown /r /t 15";
    } else if (action === "abort") {
      await showToastNotification("Shutdown Aborted", "All scheduled power sequences cancelled.");
      command = "shutdown /a";
    } else if (action === "lock") {
      await showToastNotification("System Locked", "Workstation locked by user request.");
      command = "rundll32.exe user32.dll,LockWorkStation";
    } else if (action === "sleep") {
      await showToastNotification("System Entering Sleep", "Putting workstation to sleep.");
      command = `powershell -Command "Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)"`;
    } else {
      return res.status(400).json({ error: "Invalid power action" });
    }
    
    await execAsync(command);
    res.json({ success: true, action });
  } catch (error: any) {
    if (action === "abort") {
      return res.json({ success: true, action });
    }
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

// 9. Tasks API (tasks.txt)
const tasksFilePath = path.join(process.env.USERPROFILE || "C:\\", "tasks.txt");

function getTasksFromFile(): any[] {
  try {
    if (!fs.existsSync(tasksFilePath)) {
      return [];
    }
    const rawText = fs.readFileSync(tasksFilePath, "utf-8");
    const lines = rawText.split(/\r?\n/);
    const parsedTasks = [];
    let currentId = 1;
    for (const line of lines) {
      if (!line.trim()) continue;
      let status = "pending";
      let title = line;
      const isCompleted = line.match(/^\[[xX]\]\s*(.*)$/);
      const isPending = line.match(/^\[\s*\]\s*(.*)$/);
      if (isCompleted) {
        status = "completed";
        title = isCompleted[1].trim();
      } else if (isPending) {
        status = "pending";
        title = isPending[1].trim();
      }
      parsedTasks.push({
        id: currentId++,
        title,
        status,
        created_at: new Date().toISOString()
      });
    }
    return parsedTasks;
  } catch (err) {
    console.error("Error reading tasks file:", err);
    return [];
  }
}

function saveTasksToFile(tasks: any[]) {
  const fileLines = tasks.map((t: any) => {
    const marker = t.status === "completed" ? "[x]" : "[ ]";
    return `${marker} ${t.title}`;
  });
  fs.writeFileSync(tasksFilePath, fileLines.join("\n"), "utf-8");
}

app.get("/api/tasks", (req, res) => {
  try {
    res.json(getTasksFromFile());
  } catch (err: any) {
    res.status(500).json({ error: "Failed to read tasks", details: err.message });
  }
});

app.post("/api/tasks", (req, res) => {
  const { tasks } = req.body;
  try {
    saveTasksToFile(tasks);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to write tasks", details: err.message });
  }
});

// Helper function to send native Windows Toast Notifications via PowerShell WinRT
async function showToastNotification(title: string, message: string) {
  const escapedTitle = title.replace(/'/g, "''").replace(/"/g, '\\"');
  const escapedMessage = message.replace(/'/g, "''").replace(/"/g, '\\"');
  
  const psCommand = `
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null;
    $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);
    $textNodes = $xml.GetElementsByTagName('text');
    $textNodes.Item(0).AppendChild($xml.CreateTextNode('${escapedTitle}')) | Out-Null;
    $textNodes.Item(1).AppendChild($xml.CreateTextNode('${escapedMessage}')) | Out-Null;
    $toast = New-Object Windows.UI.Notifications.ToastNotification -ArgumentList $xml;
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Microsoft.Windows.Shell.RunDialog');
    $notifier.Show($toast);
  `.replace(/\s+/g, ' ').trim();

  try {
    const execPromise = promisify(exec);
    await execPromise(`powershell -Command "${psCommand}"`);
  } catch (err: any) {
    console.error("Failed to show toast notification:", err.message);
  }
}

app.post("/api/notifications/toast", async (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: "Title and message are required" });
  }
  
  try {
    await showToastNotification(title, message);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to send toast notification", details: error.message });
  }
});

// 10. AI Agent Command Execution (Local Ollama qwen2.5-coder:7b)
const systemPrompt = `You are the core intelligence of VoicePilot, a cyberpunk terminal desktop assistant.
You can execute system actions on the user's computer by outputting a JSON object.

The user's query may request task listing, volume adjustment, brightness adjustment, application opening, or running arbitrary shell commands.

You MUST respond in raw JSON format (no markdown code blocks, just raw JSON).
The JSON object must follow this structure:
{
  "thoughts": "Brief explanation of your plan to complete the user's command",
  "actions": [
    { "type": "volume", "value": 80 }, 
    { "type": "brightness", "value": 60 }, 
    { "type": "mute", "value": true }, 
    { "type": "open", "app": "notepad|calc|browser|folder", "path": "optional web URL or folder path" },
    { "type": "task_add", "title": "Buy milk" },
    { "type": "task_complete", "id": 1, "query": "optional text query" },
    { "type": "task_delete", "id": 2, "query": "optional text query" },
    { "type": "task_clear_completed" },
    { "type": "task_clear_all" },
    { "type": "task_list" },
    { "type": "shell", "command": "PowerShell command to execute, e.g. Get-Process | Select-Object -First 5" }
  ],
  "response": "Text description of what you did. Keep it simple and clear."
}

Only return the raw JSON. Do not write any HTML, conversational text outside of the JSON, or markdown formatting tags. If no action is needed, return empty actions list.`;

app.post("/api/agent/command", async (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: "Command text is required" });
  }

  console.log(`[AI Agent]: Processing user query: "${command}"`);

  try {
    const provider = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "YOUR_API_KEY_HERE" && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY" ? "gemini" : "ollama");
    let replyContent = "";

    if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey === "MY_GEMINI_API_KEY") {
        throw new Error("Gemini API key is not configured. Please set GEMINI_API_KEY in your .env file.");
      }
      console.log(`[AI Agent]: Querying Gemini API (gemini-2.5-flash)...`);
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: command }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API responded with status ${response.status}: ${errText}`);
      }

      const data: any = await response.json();
      replyContent = data.choices[0].message.content.trim();
    } else {
      console.log(`[AI Agent]: Querying Local Ollama (qwen2.5-coder:7b)...`);
      const response = await fetch("http://localhost:11434/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer ollama"
        },
        body: JSON.stringify({
          model: "qwen2.5-coder:7b",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: command }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama responded with status ${response.status}: ${errText}`);
      }

      const data: any = await response.json();
      replyContent = data.choices[0].message.content.trim();
    }

    console.log(`[AI Agent Raw Output]: ${replyContent}`);

    // Sanitize any markdown JSON block wrapping if present
    let cleanedContent = replyContent;
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.substring(7);
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.substring(3);
    }
    if (cleanedContent.endsWith("```")) {
      cleanedContent = cleanedContent.substring(0, cleanedContent.length - 3);
    }
    cleanedContent = cleanedContent.trim();

    const parsed = JSON.parse(cleanedContent);
    const executionLogs: string[] = [];

    // Execute actions
    if (parsed.actions && Array.isArray(parsed.actions)) {
      for (const action of parsed.actions) {
        try {
          if (action.type === "volume") {
            await runPowerShellAction("SetVolume", `-Value ${action.value}`);
            executionLogs.push(`Volume set to ${action.value}%`);
          } else if (action.type === "brightness") {
            await runPowerShellAction("SetBrightness", `-Value ${action.value}`);
            executionLogs.push(`Brightness set to ${action.value}%`);
          } else if (action.type === "mute") {
            const valArg = action.value ? "$true" : "$false";
            await runPowerShellAction("SetMute", `-MuteState ${valArg}`);
            executionLogs.push(`System mute state set to ${action.value}`);
          } else if (action.type === "open") {
            let cmd = "";
            if (action.app === "browser") {
              const url = action.path || "https://google.com";
              cmd = `powershell -Command "Start-Process '${url}'"`;
            } else if (action.app === "folder") {
              const folder = action.path || path.join(process.env.USERPROFILE || "C:\\", "Downloads");
              cmd = `explorer.exe "${folder}"`;
            } else if (action.app === "notepad") {
              cmd = "notepad.exe";
            } else if (action.app === "calc") {
              cmd = "calc.exe";
            }
            if (cmd) {
              exec(cmd);
              executionLogs.push(`Launched application: ${action.app}`);
            }
          } else if (action.type === "task_add") {
            const tasks = getTasksFromFile();
            const newId = tasks.length > 0 ? Math.max(...tasks.map((t: any) => t.id)) + 1 : 1;
            tasks.push({ id: newId, title: action.title, status: "pending", created_at: new Date().toISOString() });
            saveTasksToFile(tasks);
            executionLogs.push(`Added task: "${action.title}"`);
            showToastNotification("Task Appended", `[#${newId}] ${action.title}`);
          } else if (action.type === "task_complete") {
            const tasks = getTasksFromFile();
            const target = tasks.find((t: any) => t.id === action.id || (action.query && t.title.toLowerCase().includes(action.query.toLowerCase())));
            if (target) {
              target.status = "completed";
              saveTasksToFile(tasks);
              executionLogs.push(`Completed task: "${target.title}"`);
              showToastNotification("Task Completed", target.title);
            }
          } else if (action.type === "task_delete") {
            let tasks = getTasksFromFile();
            const target = tasks.find((t: any) => t.id === action.id || (action.query && t.title.toLowerCase().includes(action.query.toLowerCase())));
            if (target) {
              tasks = tasks.filter((t: any) => t.id !== target.id);
              saveTasksToFile(tasks);
              executionLogs.push(`Deleted task: "${target.title}"`);
              showToastNotification("Task Deleted", target.title);
            }
          } else if (action.type === "task_clear_completed") {
            const tasks = getTasksFromFile();
            const completed = tasks.filter((t: any) => t.status === "completed");
            const pending = tasks.filter((t: any) => t.status !== "completed");
            saveTasksToFile(pending);
            executionLogs.push(`Cleared ${completed.length} completed task(s)`);
            showToastNotification("Tasks Cleared", `Removed ${completed.length} completed tasks.`);
          } else if (action.type === "task_clear_all") {
            saveTasksToFile([]);
            executionLogs.push(`Cleared all tasks`);
            showToastNotification("Tasks Cleared", "All tasks have been deleted.");
          } else if (action.type === "shell") {
            console.log(`[AI Agent Execution]: Running Shell Command: "${action.command}"`);
            const { stdout } = await execAsync(action.command);
            executionLogs.push(`Shell output: ${stdout.trim().substring(0, 300)}`);
          }
        } catch (actionErr: any) {
          console.error(`Failed to execute action ${action.type}:`, actionErr.message);
          executionLogs.push(`Error executing ${action.type}: ${actionErr.message}`);
        }
      }
    }

    res.json({
      thoughts: parsed.thoughts,
      response: parsed.response,
      logs: executionLogs
    });

  } catch (err: any) {
    console.error("AI Agent query failed:", err.message);
    res.status(500).json({ error: "AI agent query failed", details: err.message });
  }
});

app.post("/api/tasks/open", (req, res) => {
  exec(`notepad.exe "${tasksFilePath}"`, (err) => {
    if (err) console.error("Error opening notepad:", err);
  });
  res.json({ success: true });
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

// Background Speech Engine management
let speechProcess: any = null;
let speechReady = false;
let speechListening = false;
let sseClients: any[] = [];
let speechEngineError: string | null = null;

function startBackgroundSpeechEngine() {
  if (process.platform !== "win32") {
    console.log("Speech Engine only supported on Windows.");
    return;
  }
  
  console.log("Initializing persistent background Speech Recognition engine...");
  const command = "powershell";
  const args = ["-ExecutionPolicy", "Bypass", "-File", scriptPath, "-Action", "StartSpeechEngine"];
  
  try {
    speechProcess = spawn(command, args);
    speechEngineError = null;
    
    speechProcess.stdout.on("data", (data: Buffer) => {
      const output = data.toString().trim();
      const lines = output.split(/\r?\n/);
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        console.log(`[SpeechEngine STDOUT]: ${trimmed}`);
        
        if (trimmed === "READY") {
          speechReady = true;
          broadcastToClients({ type: "status", status: "ready" });
        } else if (trimmed === "LISTENING") {
          speechListening = true;
          broadcastToClients({ type: "status", status: "listening" });
        } else if (trimmed === "STOPPED") {
          speechListening = false;
          broadcastToClients({ type: "status", status: "stopped" });
        } else if (trimmed.startsWith("RECOGNIZED:")) {
          const text = trimmed.substring("RECOGNIZED:".length).trim();
          broadcastToClients({ type: "recognized", text });
        } else if (trimmed === "REJECTED") {
          broadcastToClients({ type: "rejected" });
        } else if (trimmed.startsWith("FATAL_ERROR:")) {
          const errMsg = trimmed.substring("FATAL_ERROR:".length).trim();
          speechEngineError = errMsg;
          broadcastToClients({ type: "error", message: errMsg });
        }
      }
    });
    
    speechProcess.stderr.on("data", (data: Buffer) => {
      const errOut = data.toString().trim();
      console.error(`[SpeechEngine STDERR]: ${errOut}`);
    });
    
    speechProcess.on("close", (code: number) => {
      console.log(`Speech engine process exited with code ${code}`);
      speechReady = false;
      speechListening = false;
      
      // Auto-restart after 5 seconds if not closed intentionally
      if (code !== 0) {
        setTimeout(startBackgroundSpeechEngine, 5000);
      }
    });
  } catch (err: any) {
    console.error("Failed to spawn background speech engine process:", err.message);
    speechEngineError = err.message;
  }
}

function broadcastToClients(data: any) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((res) => {
    try {
      res.write(msg);
    } catch (err) {
      // client disconnected
    }
  });
}

// Clean termination on server shutdown
process.on("exit", () => {
  if (speechProcess) {
    speechProcess.stdin.write("EXIT\n");
    speechProcess.kill();
  }
});
process.on("SIGINT", () => {
  if (speechProcess) {
    speechProcess.stdin.write("EXIT\n");
    speechProcess.kill();
  }
  process.exit();
});

// SSE Speech recognition endpoint
app.get("/api/speech/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  
  sseClients.push(res);
  
  // Send initial state
  res.write(`data: ${JSON.stringify({ 
    type: "status", 
    status: speechListening ? "listening" : (speechReady ? "ready" : "initializing"),
    error: speechEngineError
  })}\n\n`);
  
  req.on("close", () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

app.get("/api/speech/status", (req, res) => {
  res.json({
    status: speechListening ? "listening" : (speechReady ? "ready" : "initializing"),
    error: speechEngineError
  });
});

app.post("/api/speech/start", (req, res) => {
  if (speechProcess && speechReady) {
    speechProcess.stdin.write("START\n");
    res.json({ success: true });
  } else {
    res.status(503).json({ error: "Speech engine not ready.", details: speechEngineError });
  }
});

app.post("/api/speech/stop", (req, res) => {
  if (speechProcess && speechReady) {
    speechProcess.stdin.write("STOP\n");
    res.json({ success: true });
  } else {
    res.status(503).json({ error: "Speech engine not ready." });
  }
});

// Start the engine
startBackgroundSpeechEngine();

app.listen(PORT, () => {
  console.log(`Backend hardware management server executing on http://localhost:${PORT}`);
});
