const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config({ path: path.join(__dirname, ".env") });

const execAsync = promisify(exec);
const scriptPath = path.join(__dirname, "system_control.ps1");
const tasksFilePath = path.join(app.getPath("home"), "tasks.txt");

let mainWindow = null;
let tray = null;
let statsInterval = null;
let speechProcess = null;
let speechReady = false;
let speechListening = false;
let speechEngineError = null;

function startBackgroundSpeechEngine() {
  if (process.platform !== "win32") {
    console.log("Speech Engine only supported on Windows.");
    return;
  }
  
  console.log("Initializing persistent background Speech Recognition engine (Electron)...");
  
  try {
    speechProcess = spawn("powershell", [
      "-ExecutionPolicy", "Bypass",
      "-File", scriptPath,
      "-Action", "StartSpeechEngine"
    ]);
    speechEngineError = null;
    
    speechProcess.stdout.on("data", (data) => {
      const output = data.toString().trim();
      const lines = output.split(/\r?\n/);
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        console.log(`[Electron SpeechEngine STDOUT]: ${trimmed}`);
        
        if (trimmed === "READY") {
          speechReady = true;
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("speech-status", { status: "ready" });
          }
        } else if (trimmed === "LISTENING") {
          speechListening = true;
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("speech-status", { status: "listening" });
          }
        } else if (trimmed === "STOPPED") {
          speechListening = false;
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("speech-status", { status: "stopped" });
          }
        } else if (trimmed.startsWith("RECOGNIZED:")) {
          const text = trimmed.substring("RECOGNIZED:".length).trim();
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("speech-recognized", text);
          }
        } else if (trimmed === "REJECTED") {
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("speech-rejected");
          }
        } else if (trimmed.startsWith("FATAL_ERROR:")) {
          const errMsg = trimmed.substring("FATAL_ERROR:".length).trim();
          speechEngineError = errMsg;
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("speech-error", errMsg);
          }
        }
      }
    });
    
    speechProcess.stderr.on("data", (data) => {
      console.error(`[Electron SpeechEngine STDERR]: ${data.toString().trim()}`);
    });
    
    speechProcess.on("close", (code) => {
      console.log(`Speech engine process exited with code ${code}`);
      speechReady = false;
      speechListening = false;
      
      // Auto-restart after 5 seconds if not closed intentionally
      if (code !== 0) {
        setTimeout(startBackgroundSpeechEngine, 5000);
      }
    });
  } catch (err) {
    console.error("Failed to spawn background speech engine process:", err.message);
    speechEngineError = err.message;
  }
}

// Initialize tasks.txt with default content if it does not exist
if (!fs.existsSync(tasksFilePath)) {
  const initialContent = [
    "[ ] Set volume by saying: set volume to 50",
    "[ ] Control brightness by saying: set brightness to 80",
    "[ ] Ask me system status by saying: check system resources",
    "[x] VoicePilot Terminal Assistant successfully initialized!"
  ].join("\n");
  fs.writeFileSync(tasksFilePath, initialContent, "utf-8");
}

// Generate a simple 16x16 green dot tray icon using nativeImage (in-memory, no disk read)
const base64Png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVQ4T62T0QoAIAhD2f//6F6CIGinNzcH61o5hGjKqQMkIpK1qgA8EXn2gl7QJ6C/gL5SgGgCegrI96J1gBwPqjPgeQ4o94BqA+Bq4AewrV8E2G5gO/lkgO0DqBPwtwPiB34ASooVCl37Cg0AAAAASUVORK5CYII=";
const trayIcon = nativeImage.createFromDataURL(base64Png);

// Helper to execute PowerShell scripts
async function runPowerShellAction(action, args = "") {
  const command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -Action "${action}" ${args}`;
  try {
    const { stdout } = await execAsync(command);
    return stdout.trim();
  } catch (error) {
    console.error(`Error running PowerShell action [${action}]:`, error.message);
    throw error;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 850,
    height: 600,
    minWidth: 700,
    minHeight: 500,
    frame: false, // Frameless window for cyberpunk terminal look
    transparent: true, // Allow translucent glass/acrylic effect
    alwaysOnTop: false,
    backgroundColor: "#00000000", // Transparent background so CSS glassmorphism is visible
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true
    }
  });

  // Auto-grant microphone permissions
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true);
    }
    callback(false);
  });

  // Load the built files from the local dist folder
  mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function setupTray() {
  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Assistant (Alt+A)",
      click: () => {
        showWindow();
      }
    },
    {
      label: "Toggle Always on Top",
      type: "checkbox",
      checked: false,
      click: (item) => {
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(item.checked);
        }
      }
    },
    { type: "separator" },
    {
      label: "Exit Assistant",
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip("VoicePilot Desktop Assistant");
  tray.setContextMenu(contextMenu);
  
  tray.on("click", () => {
    toggleWindow();
  });
}

function toggleWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isVisible()) {
    if (mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.focus();
    }
  } else {
    showWindow();
  }
}

function showWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

// Background stats loop
function startStatsLoop() {
  if (statsInterval) clearInterval(statsInterval);
  statsInterval = setInterval(async () => {
    if (mainWindow && mainWindow.webContents) {
      try {
        const statsStr = await runPowerShellAction("GetStats");
        const stats = JSON.parse(statsStr);
        
        // Also fetch volume & brightness for real-time widgets
        const volStr = await runPowerShellAction("GetVolume");
        const brightStr = await runPowerShellAction("GetBrightness");
        
        stats.volume = parseFloat(volStr);
        stats.brightness = parseInt(brightStr, 10);
        
        mainWindow.webContents.send("stats-updated", stats);
      } catch (err) {
        // Silent catch, avoid console spam during shutdown/startup
      }
    }
  }, 3000);
}

// Register IPC handlers
function registerIpcHandlers() {
  // 1. Run PowerShell action
  ipcMain.handle("run-action", async (event, { action, args }) => {
    if (action === "SendMediaKey") {
      let keycode = "";
      if (args === "play_pause") keycode = "[char]179";
      else if (args === "next") keycode = "[char]176";
      else if (args === "previous") keycode = "[char]177";
      else return "Invalid key";
      const cmd = `powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys(${keycode})"`;
      await execAsync(cmd);
      return "Success";
    }
    return await runPowerShellAction(action, args);
  });

  // 1b. Background speech commands
  ipcMain.handle("start-speech", () => {
    if (speechProcess && speechReady) {
      speechProcess.stdin.write("START\n");
      return { success: true };
    } else {
      return { error: "Speech engine not ready.", details: speechEngineError };
    }
  });

  ipcMain.handle("stop-speech", () => {
    if (speechProcess && speechReady) {
      speechProcess.stdin.write("STOP\n");
      return { success: true };
    } else {
      return { error: "Speech engine not ready." };
    }
  });

  ipcMain.handle("get-speech-status", () => {
    return {
      status: speechListening ? "listening" : (speechReady ? "ready" : "initializing"),
      error: speechEngineError
    };
  });

  // 2. Launch external app
  ipcMain.handle("launch-app", async (event, { targetApp, targetPath }) => {
    let command = "";
    if (targetApp === "browser") {
      const url = targetPath || "https://google.com";
      command = `powershell -Command "Start-Process '${url}'"`;
    } else if (targetApp === "folder") {
      const folder = targetPath || app.getPath("downloads");
      command = `explorer.exe "${folder}"`;
    } else if (targetApp === "notepad") {
      command = "notepad.exe";
    } else if (targetApp === "calc") {
      command = "calc.exe";
    } else {
      throw new Error(`Unsupported application type: ${targetApp}`);
    }

    exec(command, (err) => {
      if (err) console.error(`Error opening app ${targetApp}:`, err);
    });
    return true;
  });

  // 3. System Shutdown & Power Controls
  ipcMain.handle("shutdown-control", async (event, { action }) => {
    let command = "";
    if (action === "shutdown") {
      command = "shutdown /s /t 15";
    } else if (action === "restart") {
      command = "shutdown /r /t 15";
    } else if (action === "abort") {
      command = "shutdown /a";
    } else if (action === "lock") {
      command = "rundll32.exe user32.dll,LockWorkStation";
    } else if (action === "sleep") {
      // Runs PowerShell command to suspend system
      command = `powershell -Command "Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)"`;
    } else {
      throw new Error(`Unsupported power action: ${action}`);
    }

    try {
      await execAsync(command);
      return true;
    } catch (error) {
      // Ignore abort errors if shutdown wasn't scheduled
      if (action === "abort") return true;
      throw error;
    }
  });

  // Helper functions for reading/writing tasks
  function readTasksHelper() {
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

  function writeTasksHelper(tasks) {
    try {
      const fileLines = tasks.map(t => {
        const marker = t.status === "completed" ? "[x]" : "[ ]";
        return `${marker} ${t.title}`;
      });
      fs.writeFileSync(tasksFilePath, fileLines.join("\n"), "utf-8");
      return true;
    } catch (err) {
      console.error("Error writing tasks file:", err);
      throw err;
    }
  }

  // 4. Read tasks from tasks.txt
  ipcMain.handle("read-tasks-file", async () => {
    return readTasksHelper();
  });

  // 5. Write tasks back to tasks.txt
  ipcMain.handle("write-tasks-file", async (event, tasks) => {
    return writeTasksHelper(tasks);
  });

  // 5b. Local AI Agent Command Execution (Electron mode)
  ipcMain.handle("agent-command", async (event, command) => {
    console.log(`[Electron AI Agent]: Processing user query: "${command}"`);
    
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

    try {
      const provider = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "YOUR_API_KEY_HERE" && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY" ? "gemini" : "ollama");
      let replyContent = "";

      if (provider === "gemini") {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey === "MY_GEMINI_API_KEY") {
          throw new Error("Gemini API key is not configured. Please set GEMINI_API_KEY in your .env file.");
        }
        console.log(`[Electron AI Agent]: Querying Gemini API (gemini-2.5-flash)...`);
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

        const data = await response.json();
        replyContent = data.choices[0].message.content.trim();
      } else {
        console.log(`[Electron AI Agent]: Querying Local Ollama (qwen2.5-coder:7b)...`);
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

        const data = await response.json();
        replyContent = data.choices[0].message.content.trim();
      }

      console.log(`[Electron AI Agent Raw Output]: ${replyContent}`);

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
      const executionLogs = [];

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
                const folder = action.path || path.join(app.getPath("home"), "Downloads");
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
              const tasks = readTasksHelper();
              const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
              tasks.push({ id: newId, title: action.title, status: "pending", created_at: new Date().toISOString() });
              writeTasksHelper(tasks);
              executionLogs.push(`Added task: "${action.title}"`);
            } else if (action.type === "task_complete") {
              const tasks = readTasksHelper();
              const target = tasks.find(t => t.id === action.id || (action.query && t.title.toLowerCase().includes(action.query.toLowerCase())));
              if (target) {
                target.status = "completed";
                writeTasksHelper(tasks);
                executionLogs.push(`Completed task: "${target.title}"`);
              }
            } else if (action.type === "task_delete") {
              let tasks = readTasksHelper();
              const target = tasks.find(t => t.id === action.id || (action.query && t.title.toLowerCase().includes(action.query.toLowerCase())));
              if (target) {
                tasks = tasks.filter(t => t.id !== target.id);
                writeTasksHelper(tasks);
                 executionLogs.push(`Deleted task: "${target.title}"`);
              }
            } else if (action.type === "task_clear_completed") {
              const tasks = readTasksHelper();
              const completed = tasks.filter(t => t.status === "completed");
              const pending = tasks.filter(t => t.status !== "completed");
              writeTasksHelper(pending);
              executionLogs.push(`Cleared ${completed.length} completed task(s)`);
            } else if (action.type === "task_clear_all") {
              writeTasksHelper([]);
              executionLogs.push(`Cleared all tasks`);
            } else if (action.type === "shell") {
              console.log(`[Electron AI Agent Execution]: Running Shell Command: "${action.command}"`);
              const { stdout } = await execAsync(action.command);
              executionLogs.push(`Shell output: ${stdout.trim().substring(0, 300)}`);
            }
          } catch (actionErr) {
            console.error(`Failed to execute action ${action.type}:`, actionErr.message);
            executionLogs.push(`Error executing ${action.type}: ${actionErr.message}`);
          }
        }
      }

      return {
        thoughts: parsed.thoughts,
        response: parsed.response,
        logs: executionLogs
      };

    } catch (err) {
      console.error("Electron AI Agent query failed:", err.message);
      return { error: "AI agent query failed", details: err.message };
    }
  });

  // 6. Open tasks file in Notepad
  ipcMain.handle("open-tasks-in-notepad", async () => {
    exec(`notepad.exe "${tasksFilePath}"`, (err) => {
      if (err) console.error("Error opening notepad:", err);
    });
    return true;
  });

  // 7. Get API Key safely
  ipcMain.handle("get-api-key", () => {
    return process.env.GEMINI_API_KEY || "";
  });

  // 8. Custom Window Control (frameless titlebar)
  ipcMain.on("window-control", (event, action) => {
    if (!mainWindow) return;
    if (action === "close") {
      mainWindow.hide(); // Minimize to tray instead of quitting
    } else if (action === "minimize") {
      mainWindow.minimize();
    } else if (action === "maximize") {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    } else if (action === "toggle-always-on-top") {
      const isTop = mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(!isTop);
      event.reply("always-on-top-status", !isTop);
    }
  });
}

// App lifecycle hooks
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  setupTray();
  startStatsLoop();
  startBackgroundSpeechEngine();

  // Register Alt+A global hotkey to show/hide assistant
  globalShortcut.register("Alt+A", () => {
    toggleWindow();
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.webContents.send("shortcut-triggered");
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (statsInterval) clearInterval(statsInterval);
  if (speechProcess) {
    speechProcess.stdin.write("EXIT\n");
    speechProcess.kill();
  }
});

app.on("window-all-closed", () => {
  // In a real tray app, we don't quit on window close, we let the tray keep it alive
  if (process.platform !== "darwin" && app.isQuitting) {
    app.quit();
  }
});
