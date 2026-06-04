import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface ClaudeSettings {
  env?: Record<string, string | undefined>;
  [key: string]: unknown;
}

interface ClaudeModels {
  sonnetModel: string;
  opusModel: string;
  smallFastModel: string;
}

interface ClaudeAuth {
  authToken: string;
  baseUrl: string;
}

function getSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

/** Strip ANSI escape codes (terminal formatting artifacts) from strings */
function cleanAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[\d+m\]?/g, '').trim();
}

function readSettingsFile(): ClaudeSettings {
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content) as ClaudeSettings;
  } catch {
    return {};
  }
}

function writeSettingsFile(settings: ClaudeSettings): void {
  const settingsPath = getSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

export function readClaudeModels(): ClaudeModels {
  const settings = readSettingsFile();
  const env = settings.env || {};
  return {
    sonnetModel: cleanAnsi(env.ANTHROPIC_DEFAULT_SONNET_MODEL || ''),
    opusModel: cleanAnsi(env.ANTHROPIC_DEFAULT_OPUS_MODEL || ''),
    smallFastModel: cleanAnsi(env.ANTHROPIC_SMALL_FAST_MODEL || ''),
  };
}

export function readClaudeAuth(): ClaudeAuth {
  const settings = readSettingsFile();
  const env = settings.env || {};
  return {
    authToken: cleanAnsi(env.ANTHROPIC_AUTH_TOKEN || ''),
    baseUrl: cleanAnsi(env.ANTHROPIC_BASE_URL || ''),
  };
}

export function readClaudeSettings(): ClaudeModels & ClaudeAuth {
  const settings = readSettingsFile();
  const env = settings.env || {};
  return {
    sonnetModel: cleanAnsi(env.ANTHROPIC_DEFAULT_SONNET_MODEL || ''),
    opusModel: cleanAnsi(env.ANTHROPIC_DEFAULT_OPUS_MODEL || ''),
    smallFastModel: cleanAnsi(env.ANTHROPIC_SMALL_FAST_MODEL || ''),
    authToken: cleanAnsi(env.ANTHROPIC_AUTH_TOKEN || ''),
    baseUrl: cleanAnsi(env.ANTHROPIC_BASE_URL || ''),
  };
}

export function writeClaudeModels(models: Partial<ClaudeModels>): void {
  const settings = readSettingsFile();
  if (!settings.env) {
    settings.env = {};
  }
  if (models.sonnetModel !== undefined) {
    settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL = cleanAnsi(models.sonnetModel) || undefined;
  }
  if (models.opusModel !== undefined) {
    settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL = cleanAnsi(models.opusModel) || undefined;
  }
  if (models.smallFastModel !== undefined) {
    settings.env.ANTHROPIC_SMALL_FAST_MODEL = cleanAnsi(models.smallFastModel) || undefined;
  }
  writeSettingsFile(settings);
}

export function writeClaudeAuth(auth: Partial<ClaudeAuth>): void {
  const settings = readSettingsFile();
  if (!settings.env) {
    settings.env = {};
  }
  if (auth.authToken !== undefined) {
    settings.env.ANTHROPIC_AUTH_TOKEN = cleanAnsi(auth.authToken) || undefined;
  }
  if (auth.baseUrl !== undefined) {
    settings.env.ANTHROPIC_BASE_URL = cleanAnsi(auth.baseUrl) || undefined;
  }
  writeSettingsFile(settings);
}
