import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export function command(executable, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, { windowsHide: true, shell: false, ...options });
    let stdout = ''; let stderr = ''; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 120000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); if (timedOut) reject(new Error('n8n runtime command timed out')); else resolvePromise({ code, stdout, stderr }); });
  });
}
export async function locateRuntime(projectRoot) {
  const home = resolve(process.env.N8N_RUNTIME_HOME || join(projectRoot, '../../n8n-nodes-thordata-testenv/n8n-instance/node_modules/n8n'));
  assert.ok(existsSync(join(home, 'bin/n8n')), 'Set N8N_RUNTIME_HOME to a compatible installed n8n package directory.');
  const req = createRequire(join(home, 'package.json'));
  const info = JSON.parse(readFileSync(join(home, 'package.json'), 'utf8'));
  const candidates = [process.execPath];
  for (const root of [process.env.NVM_HOME, 'E:/nvm', join(process.env.APPDATA || '', 'nvm')].filter(Boolean)) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) if (entry.isDirectory() && /^v(?:18|20|22)\./.test(entry.name)) candidates.push(join(root, entry.name, process.platform === 'win32' ? 'node.exe' : 'bin/node'));
  }
  if (process.env.N8N_RUNTIME_NODE) candidates.unshift(resolve(process.env.N8N_RUNTIME_NODE));
  for (const executable of [...new Set(candidates)]) {
    if (!existsSync(executable)) continue;
    const result = await command(executable, ['--version']);
    if (result.code !== 0 || !req('semver/functions/satisfies')(result.stdout.trim(), info.engines.node)) continue;
    const version = name => JSON.parse(readFileSync(req.resolve(`${name}/package.json`), 'utf8')).version;
    return { home, executable, node: result.stdout.trim(), n8n: info.version, nodesBase: version('n8n-nodes-base'), langchain: version('@n8n/n8n-nodes-langchain') };
  }
  throw new Error(`No installed Node satisfies ${info.engines.node}; set N8N_RUNTIME_NODE.`);
}
export function parseExecution(stdout) {
  for (let start = 0; start < stdout.length; start++) {
    if (stdout[start] !== '{' || start > 0 && stdout[start - 1] !== '\n') continue;
    let depth = 0; let quoted = false; let escaped = false;
    for (let at = start; at < stdout.length; at++) {
      const c = stdout[at];
      if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
      if (c === '"') quoted = true; else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) { try { const result = JSON.parse(stdout.slice(start, at + 1)); if (result?.data?.resultData) return result; } catch {} break; }
    }
  }
  throw new Error(`No n8n execution JSON found: ${stdout.slice(-4000)}`);
}
export function isolatedEnvironment(directory, allowedTypes) {
  const env = {};
  for (const key of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'ProgramData', 'PATHEXT', 'PATH', 'Path', 'HOME', 'USERPROFILE', 'LANG']) if (process.env[key] !== undefined) env[key] = process.env[key];
  return { ...env, N8N_USER_FOLDER: directory, DB_TYPE: 'sqlite', DB_SQLITE_DATABASE: join(directory, 'offline.sqlite'), N8N_ENCRYPTION_KEY: 'offline-fixture-key-not-a-credential', N8N_RUNNERS_ENABLED: 'false', N8N_DIAGNOSTICS_ENABLED: 'false', N8N_VERSION_NOTIFICATIONS_ENABLED: 'false', N8N_TEMPLATES_ENABLED: 'false', N8N_COMMUNITY_PACKAGES_ENABLED: 'false', N8N_LICENSE_AUTO_RENEW_ENABLED: 'false', N8N_SENTRY_DSN: '', N8N_FRONTEND_SENTRY_DSN: '', N8N_LOG_LEVEL: 'info', EXECUTIONS_MODE: 'regular', N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'false', N8N_BLOCK_ENV_ACCESS_IN_NODE: 'true', NODES_INCLUDE: JSON.stringify(allowedTypes), GENERIC_TIMEZONE: 'Asia/Shanghai' };
}
export function networkGuard(directory) {
  const path = join(directory, 'deny-network.cjs');
  writeFileSync(path, `const deny=()=>{throw new Error('Offline runtime validation forbids network and listeners');};
const net=require('node:net');net.connect=net.createConnection=net.Socket.prototype.connect=net.Server.prototype.listen=deny;
require('node:tls').connect=deny;require('node:dgram').createSocket=deny;
for(const name of ['node:http','node:https']){const m=require(name);m.request=m.get=deny;}globalThis.fetch=deny;\n`, 'utf8');
  return path;
}
export function removeTemporaryDirectory(directory) {
  const root = resolve(tmpdir());
  assert.ok(isAbsolute(directory) && dirname(directory) === root && /^thordata-shopping-runtime-[^\\/]+$/.test(relative(root, directory)), 'Refusing to remove a path outside the isolated runtime directory');
  rmSync(directory, { recursive: true, force: true });
  return !existsSync(directory);
}
