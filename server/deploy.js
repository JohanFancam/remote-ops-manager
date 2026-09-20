/**
 * In-app one-click deploy. Runs deploy.sh on the live host so an admin
 * can ship a branch without SSH. Status/logs survive the PM2 restart.
 */
import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRANCH_RE = /^(main|cursor\/[a-z0-9][a-z0-9./_-]{0,80})$/;

function dataDir() {
  if (process.env.DEPLOY_STATE_DIR) return path.resolve(process.env.DEPLOY_STATE_DIR);
  if (process.env.DATABASE_PATH) return path.dirname(path.resolve(process.env.DATABASE_PATH));
  return path.join(ROOT, 'server', 'data');
}

export function statusPath() {
  return path.join(dataDir(), 'deploy-status.json');
}

export function logPath() {
  return path.join(dataDir(), 'deploy.log');
}

export function isSafeBranch(name) {
  const branch = String(name || '').trim();
  return BRANCH_RE.test(branch) && !branch.includes('..');
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function git(args, timeout = 8000) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout,
  }).trim();
}

function pidAlive(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch {
    return false;
  }
}

export function canDeployHere() {
  if (String(process.env.ALLOW_IN_APP_DEPLOY || '').toLowerCase() === 'false') {
    return { ok: false, reason: 'In-app deploy is turned off on this host.' };
  }
  if (String(process.env.ALLOW_IN_APP_DEPLOY || '').toLowerCase() === 'true') {
    return { ok: true };
  }
  if (process.env.pm_id || process.env.PM2_HOME || process.env.NODE_ENV === 'production') {
    return { ok: true };
  }
  return {
    ok: false,
    reason: 'This copy is not the live server. After this update is on Lightsail once, use Settings → Deploy on remoteopsmanger.com.',
  };
}

function currentGit() {
  try {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
    const sha = git(['rev-parse', '--short', 'HEAD']);
    const subject = git(['log', '-1', '--pretty=%s']);
    const committedAt = git(['log', '-1', '--pretty=%cI']);
    return { branch, sha, subject, committedAt };
  } catch {
    return { branch: '', sha: '', subject: '', committedAt: '' };
  }
}

export function listDeployBranches() {
  const names = new Set();
  const current = currentGit().branch;
  if (isSafeBranch(current)) names.add(current);
  try {
    const remote = git(['ls-remote', '--heads', 'origin'], 20000);
    for (const line of remote.split('\n')) {
      const match = line.match(/refs\/heads\/(.+)$/);
      if (match && isSafeBranch(match[1])) names.add(match[1]);
    }
  } catch {
    try {
      const local = git(['branch', '--format=%(refname:short)']);
      for (const name of local.split('\n')) {
        if (isSafeBranch(name)) names.add(name);
      }
    } catch {
      // ignore
    }
  }
  return [...names].sort((a, b) => {
    if (a === 'main') return -1;
    if (b === 'main') return 1;
    return a.localeCompare(b);
  });
}

export function readDeployStatus() {
  const stored = readJson(statusPath(), {});
  if (stored.state === 'running' && stored.pid && !pidAlive(stored.pid)) {
    const next = {
      ...stored,
      state: 'failed',
      exitCode: stored.exitCode ?? 1,
      finishedAt: stored.finishedAt || new Date().toISOString(),
      error: stored.error || 'Deploy process stopped before it finished.',
    };
    writeJson(statusPath(), next);
    return next;
  }
  return stored;
}

export function readDeployLog(limit = 12000) {
  try {
    const text = fs.readFileSync(logPath(), 'utf8');
    if (text.length <= limit) return text;
    return text.slice(-limit);
  } catch {
    return '';
  }
}

export function writeDeployStatus(patch) {
  const prev = readJson(statusPath(), {});
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  writeJson(statusPath(), next);
  return next;
}

export function finishDeploy(exitCode) {
  const code = Number(exitCode);
  return writeDeployStatus({
    state: code === 0 ? 'success' : 'failed',
    exitCode: Number.isFinite(code) ? code : 1,
    finishedAt: new Date().toISOString(),
    pid: null,
  });
}

function rotateLog() {
  const file = logPath();
  try {
    const stat = fs.statSync(file);
    if (stat.size > 400_000) {
      const text = fs.readFileSync(file, 'utf8').slice(-80_000);
      fs.writeFileSync(file, text);
    }
  } catch {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
  }
}

export function startDeploy({ branch, triggeredBy = '' }) {
  const allowed = canDeployHere();
  if (!allowed.ok) {
    const err = new Error(allowed.reason);
    err.status = 400;
    throw err;
  }
  if (!isSafeBranch(branch)) {
    const err = new Error('Choose main or a cursor/… branch.');
    err.status = 400;
    throw err;
  }

  const current = readDeployStatus();
  if (current.state === 'running' && pidAlive(current.pid)) {
    const err = new Error('A deploy is already running.');
    err.status = 409;
    throw err;
  }

  rotateLog();
  const startedAt = new Date().toISOString();
  writeDeployStatus({
    state: 'running',
    branch,
    triggeredBy,
    startedAt,
    finishedAt: null,
    exitCode: null,
    error: '',
    pid: null,
  });

  const child = spawn('bash', [path.join(ROOT, 'scripts', 'one-click-deploy.sh'), branch], {
    cwd: ROOT,
    detached: true,
    env: {
      ...process.env,
      APP_DIR: ROOT,
      DEPLOY_STATUS_FILE: statusPath(),
      DEPLOY_LOG_FILE: logPath(),
      DEPLOY_BRANCH: branch,
      DEPLOY_TRIGGERED_BY: triggeredBy,
      DEPLOY_STARTED_AT: startedAt,
    },
    stdio: 'ignore',
  });
  child.unref();

  writeDeployStatus({ pid: child.pid, state: 'running', branch, triggeredBy, startedAt });
  return readDeployStatus();
}

export function getDeploySnapshot() {
  const live = canDeployHere();
  return {
    canDeploy: live.ok,
    reason: live.ok ? '' : live.reason,
    current: currentGit(),
    branches: listDeployBranches(),
    status: readDeployStatus(),
    log: readDeployLog(),
  };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked && process.argv[2] === 'finish') {
  finishDeploy(process.argv[3]);
}
