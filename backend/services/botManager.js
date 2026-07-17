const { spawn, exec } = require('child_process');
const path = require('path');
const fs   = require('fs');
const util = require('util');
const execAsync = util.promisify(exec);

const BOTS_DIR = path.join(__dirname, '../../bots');
const MAX_LOGS  = 150;

// In-memory process map: deploymentId → { proc, logs[], startedAt }
const processes = new Map();

function botDir(deploymentId) {
    return path.join(BOTS_DIR, deploymentId.toString());
}

// ── Framework Detection ──────────────────────────────────────────────────
function detectFramework(dir) {
    const pkgPath = path.join(dir, 'package.json');
    let framework = 'Node.js Bot';
    let entryPoint = 'index.js';

    if (!fs.existsSync(pkgPath)) return { framework, entryPoint };

    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps['@whiskeysockets/baileys'])      framework = 'Baileys (WS)';
        else if (deps['@adiwajshing/baileys'])    framework = 'Baileys';
        else if (deps['whatsapp-web.js'])         framework = 'WWebJS';
        else if (deps['venom-bot'])               framework = 'Venom Bot';
        else if (deps['@open-wa/wa-automate'])    framework = 'Open-WA';
        else if (deps['wa-automate-nodejs'])      framework = 'WA-Automate';
        else if (deps['@brunocgc/baileys'])       framework = 'Baileys (BCG)';
        else if (deps['@whiskeysockets/baileys'] || deps['baileys']) framework = 'Baileys';

        // Detect entry point from scripts.start or main
        if (pkg.scripts?.start) {
            const match = pkg.scripts.start.match(/node\s+([\w./\\-]+\.js)/);
            if (match) entryPoint = match[1];
        } else if (pkg.main) {
            entryPoint = pkg.main;
        }

        // Fallback: look for common entry files
        const candidates = [entryPoint, 'index.js', 'main.js', 'app.js', 'bot.js', 'start.js'];
        for (const c of candidates) {
            if (fs.existsSync(path.join(dir, c))) { entryPoint = c; break; }
        }

    } catch (e) { /* ignore parse errors */ }

    return { framework, entryPoint };
}

// ── Clone Repository ─────────────────────────────────────────────────────
async function cloneRepo(repoUrl, deploymentId, onLog) {
    const dir = botDir(deploymentId);

    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });

    onLog(`Cloning ${repoUrl}...`, 'info');

    try {
        await execAsync(`git clone --depth 1 "${repoUrl}" "${dir}"`, { timeout: 120000 });
        onLog('Repository cloned successfully.', 'info');
    } catch (err) {
        onLog(`Clone failed: ${err.message}`, 'error');
        throw new Error('Failed to clone repository: ' + err.message);
    }

    const { framework, entryPoint } = detectFramework(dir);
    onLog(`Detected framework: ${framework}`, 'info');
    onLog(`Entry point: ${entryPoint}`, 'info');

    return { framework, entryPoint };
}

// ── Install Dependencies ──────────────────────────────────────────────────
async function installDeps(deploymentId, onLog) {
    const dir = botDir(deploymentId);
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        onLog('No package.json found — skipping install.', 'warn');
        return;
    }

    onLog('Installing dependencies (npm install)...', 'info');
    try {
        await execAsync('npm install --production --prefer-offline', { cwd: dir, timeout: 180000 });
        onLog('Dependencies installed.', 'info');
    } catch (err) {
        onLog(`npm install failed: ${err.message}`, 'warn');
    }
}

// ── Write .env file ───────────────────────────────────────────────────────
function writeEnv(deploymentId, envVars) {
    const dir = botDir(deploymentId);
    if (!fs.existsSync(dir)) return;
    const content = Object.entries(envVars)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
    fs.writeFileSync(path.join(dir, '.env'), content, 'utf8');
}

// ── Push log to in-memory + return for DB save ────────────────────────────
function pushLog(deploymentId, message, level = 'info') {
    if (!processes.has(deploymentId)) {
        processes.set(deploymentId, { proc: null, logs: [] });
    }
    const entry = { message, level, timestamp: new Date() };
    const state = processes.get(deploymentId);
    state.logs.unshift(entry);
    if (state.logs.length > MAX_LOGS) state.logs = state.logs.slice(0, MAX_LOGS);
    return entry;
}

// ── Start Bot ─────────────────────────────────────────────────────────────
async function startBot(deployment, onLog) {
    const id  = deployment._id.toString();
    const dir = botDir(id);

    if (!fs.existsSync(dir)) {
        throw new Error('Bot files not found. Please re-deploy from GitHub.');
    }

    // Kill existing process if any
    stopBot(id);

    const entryPoint = deployment.entryPoint || 'index.js';
    const entryPath  = path.join(dir, entryPoint);

    if (!fs.existsSync(entryPath)) {
        throw new Error(`Entry file "${entryPoint}" not found in repo.`);
    }

    onLog(`Starting bot process: node ${entryPoint}`, 'info');

    const proc = spawn('node', [entryPoint], {
        cwd: dir,
        env: { ...process.env, NODE_ENV: 'production' },
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    if (!processes.has(id)) processes.set(id, { proc: null, logs: [], startedAt: null });
    const state = processes.get(id);
    state.proc      = proc;
    state.startedAt = new Date();

    proc.stdout.on('data', data => {
        const msg = data.toString().trim();
        if (msg) pushLog(id, msg, 'info');
    });

    proc.stderr.on('data', data => {
        const msg = data.toString().trim();
        if (msg) pushLog(id, msg, 'error');
    });

    proc.on('exit', (code, signal) => {
        const msg = `Process exited (code=${code}, signal=${signal})`;
        pushLog(id, msg, 'warn');
        if (state.proc === proc) state.proc = null;
    });

    proc.on('error', err => {
        pushLog(id, `Process error: ${err.message}`, 'error');
        if (state.proc === proc) state.proc = null;
    });

    onLog(`Bot started (PID: ${proc.pid})`, 'info');
    return proc.pid;
}

// ── Stop Bot ──────────────────────────────────────────────────────────────
function stopBot(deploymentId) {
    const id    = deploymentId.toString();
    const state = processes.get(id);
    if (state?.proc) {
        try { state.proc.kill('SIGTERM'); } catch (_) {}
        state.proc      = null;
        state.startedAt = null;
        pushLog(id, 'Bot stopped.', 'warn');
    }
}

// ── Get Start Time ────────────────────────────────────────────────────────
function getStartedAt(deploymentId) {
    return processes.get(deploymentId.toString())?.startedAt || null;
}

// ── Restart Bot ───────────────────────────────────────────────────────────
async function restartBot(deployment, onLog) {
    const id = deployment._id.toString();
    pushLog(id, 'Restarting bot...', 'info');
    stopBot(id);
    await new Promise(r => setTimeout(r, 1200));
    return startBot(deployment, onLog);
}

// ── Is Running ────────────────────────────────────────────────────────────
function isRunning(deploymentId) {
    const id    = deploymentId.toString();
    const state = processes.get(id);
    if (!state?.proc) return false;
    try {
        process.kill(state.proc.pid, 0);
        return true;
    } catch (_) {
        return false;
    }
}

// ── Get Logs ──────────────────────────────────────────────────────────────
function getLogs(deploymentId) {
    return processes.get(deploymentId.toString())?.logs || [];
}

module.exports = { cloneRepo, installDeps, writeEnv, startBot, stopBot, restartBot, isRunning, getLogs, pushLog, detectFramework, botDir, getStartedAt };
