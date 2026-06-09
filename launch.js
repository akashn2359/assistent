import { spawn } from "child_process";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Find system Chrome path
function getChromePath() {
  const paths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.USERPROFILE}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// 2. Start the Express server in the background
console.log("Initializing VoicePilot Server...");
const serverProcess = spawn("npx", ["tsx", path.join(__dirname, "server.ts")], {
  cwd: __dirname,
  stdio: "ignore", // Run silently
  shell: true
});

// 3. Monitor server port until active
function checkServer(callback) {
  http.get("http://localhost:3001/api/tasks", (res) => {
    if (res.statusCode === 200) {
      callback();
    } else {
      setTimeout(() => checkServer(callback), 250);
    }
  }).on("error", () => {
    setTimeout(() => checkServer(callback), 250);
  });
}

checkServer(() => {
  console.log("Server online. Launching borderless UI window...");
  const chromePath = getChromePath();
  
  if (chromePath) {
    // Launch Chrome in App Mode directly so we can monitor its process lifecycle
    const chromeProcess = spawn(chromePath, ["--app=http://localhost:3001"], {
      detached: false
    });
    
    // Auto-terminate server when user closes the window
    chromeProcess.on("close", () => {
      console.log("UI window closed. Terminating server...");
      serverProcess.kill();
      process.exit(0);
    });
    
    chromeProcess.on("exit", () => {
      console.log("UI window exited. Terminating server...");
      serverProcess.kill();
      process.exit(0);
    });
  } else {
    console.warn("Google Chrome not found in standard paths. Falling back to default shell launcher...");
    // Fallback to start command
    spawn("cmd.exe", ["/c", "start chrome --app=http://localhost:3001"], { shell: true });
    console.log("Launched. Please close the console to exit.");
  }
});

// Handle unexpected launcher exit (Ctrl+C in terminal)
process.on("SIGINT", () => {
  serverProcess.kill();
  process.exit(0);
});
process.on("exit", () => {
  serverProcess.kill();
});
