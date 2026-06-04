const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const isWindows = process.platform === "win32";
const projectRoot = path.resolve(__dirname, "..");
const modelName = "mistral";
const npmExecPath = process.env.npm_execpath;

function getBinCommand(bin) {
  if (!isWindows) return bin;
  if (bin === "npm") return "npm.cmd";
  return `${bin}.exe`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(bin, args, options = {}) {
  return new Promise((resolve, reject) => {
    const command =
      bin === "npm" && npmExecPath ? process.execPath : getBinCommand(bin);
    const commandArgs =
      bin === "npm" && npmExecPath ? [npmExecPath, ...args] : args;

    const child = spawn(command, commandArgs, {
      cwd: projectRoot,
      stdio: options.captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
      env: { ...process.env, ...(options.env || {}) },
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    if (options.captureOutput) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `${bin} ${args.join(" ")} failed with code ${code}\n${stderr}`.trim()
          )
        );
      }
    });
  });
}

async function isOllamaReady() {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags");
    return response.ok;
  } catch (_error) {
    return false;
  }
}

async function ensureCommandAvailable(bin) {
  if (bin === "npm" && npmExecPath) {
    return;
  }

  try {
    await runCommand(bin, ["--version"], { captureOutput: true });
  } catch (_error) {
    throw new Error(`Missing required command: ${bin}`);
  }
}

async function ensureNodeModules() {
  if (fs.existsSync(path.join(projectRoot, "node_modules"))) {
    return;
  }

  console.log("Installing npm dependencies...");
  await runCommand("npm", ["install"]);
}

async function ensureOllamaRunning() {
  if (await isOllamaReady()) {
    return;
  }

  console.log("Starting Ollama...");
  const ollamaProcess = spawn(getBinCommand("ollama"), ["serve"], {
    cwd: projectRoot,
    detached: true,
    stdio: "ignore",
    shell: false,
  });
  ollamaProcess.unref();

  for (let index = 0; index < 20; index += 1) {
    await sleep(1000);
    if (await isOllamaReady()) {
      return;
    }
  }

  throw new Error("Ollama did not become ready on http://127.0.0.1:11434");
}

async function ensureModelPulled() {
  const { stdout } = await runCommand("ollama", ["list"], {
    captureOutput: true,
  });

  if (new RegExp(`\\b${modelName}\\b`, "i").test(stdout)) {
    return;
  }

  console.log(`Pulling Ollama model '${modelName}'...`);
  await runCommand("ollama", ["pull", modelName]);
}

async function launchApp() {
  console.log("Launching ProcAIstination...");
  await runCommand("npm", ["run", "dev"]);
}

async function main() {
  await ensureCommandAvailable("node");
  await ensureCommandAvailable("npm");
  await ensureCommandAvailable("ollama");
  await ensureNodeModules();
  await ensureOllamaRunning();
  await ensureModelPulled();
  await launchApp();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
