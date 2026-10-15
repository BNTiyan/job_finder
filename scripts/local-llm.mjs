#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const models = path.join(root, "ollama_models");
const host = "127.0.0.1:11435";
const env = { ...process.env, OLLAMA_HOST: host, OLLAMA_MODELS: models, OLLAMA_NO_CLOUD: "1" };
fs.mkdirSync(models, { recursive: true });

if (process.argv[2] === "install") {
  const lookup = spawnSync("/usr/bin/which", ["ollama"], { encoding: "utf8" });
  if (lookup.status !== 0) throw new Error("Install Ollama before configuring the local service.");
  const binary = lookup.stdout.trim();
  const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const label = "com.jobfinder.ollama";
  const agents = path.join(os.homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(agents, `${label}.plist`);
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${escape(binary)}</string><string>serve</string></array>
<key>WorkingDirectory</key><string>${escape(root)}</string>
<key>EnvironmentVariables</key><dict>
<key>OLLAMA_HOST</key><string>${host}</string>
<key>OLLAMA_MODELS</key><string>${escape(models)}</string>
<key>OLLAMA_NO_CLOUD</key><string>1</string>
</dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>/tmp/ollama_jobfinder.out</string>
<key>StandardErrorPath</key><string>/tmp/ollama_jobfinder.err</string>
</dict></plist>
`;
  fs.mkdirSync(agents, { recursive: true });
  // Refuse to silently replace an existing, different launch agent.
  if (fs.existsSync(plistPath) && fs.readFileSync(plistPath, "utf8") !== plist) {
    throw new Error(`A different launch agent already exists at ${plistPath}. Review it first.`);
  }
  fs.writeFileSync(plistPath, plist);
  const domain = `gui/${os.userInfo().uid}`;
  const loaded = spawnSync("launchctl", ["print", `${domain}/${label}`], { stdio: "ignore" }).status === 0;
  if (!loaded) {
    const installed = spawnSync("launchctl", ["bootstrap", domain, plistPath], { stdio: "inherit" });
    if (installed.status !== 0) process.exit(installed.status || 1);
  }
  console.log(`Dedicated Ollama launch agent active on ${host}. Models: ${models}`);
} else if (process.argv[2] === "pull") {
  const child = spawn("ollama", ["pull", process.env.LOCAL_LLM_MODEL || "qwen2.5:3b"], { env, stdio: "inherit" });
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
} else {
  const child = spawn("ollama", ["serve"], { env, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 0; });
}
