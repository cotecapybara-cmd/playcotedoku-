import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  Difficulty,
  GameHistoryEntry,
  GameMode,
  MultiplayerRoomView,
  PublicPlayer,
  RoomChatMessage,
  RoomParticipant,
  SavedGame,
  UserProfile,
} from './src/shared/types.ts';
import {
  cloneBoard,
  createEmptyNotes,
  DIFFICULTY_CONFIG,
  generateSudoku,
  getProgressStats,
  isBoardSolved,
} from './src/shared/sudoku.ts';
import { CAPYBARA_AVATARS, DEFAULT_AVATAR_ID } from './src/shared/avatars.ts';
import { ACHIEVEMENTS, getLevelFromXp } from './src/shared/achievements.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'playcotedoku.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT 'Sipping coffee & solving Sudoku.',
    avatar_id TEXT NOT NULL DEFAULT '${DEFAULT_AVATAR_ID}',
    theme TEXT NOT NULL DEFAULT 'light',
    sound_enabled INTEGER NOT NULL DEFAULT 1,
    music_enabled INTEGER NOT NULL DEFAULT 0,
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    fast_pencil_default INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    streak_days INTEGER NOT NULL DEFAULT 0,
    win_streak INTEGER NOT NULL DEFAULT 0,
    best_win_streak INTEGER NOT NULL DEFAULT 0,
    last_daily_date TEXT,
    wins INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    perfect_games INTEGER NOT NULL DEFAULT 0,
    best_time_easy INTEGER,
    best_time_medium INTEGER,
    best_time_hard INTEGER,
    best_time_expert INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS saved_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    puzzle_json TEXT NOT NULL,
    solution_json TEXT NOT NULL,
    board_json TEXT NOT NULL,
    notes_json TEXT NOT NULL,
    elapsed_seconds INTEGER NOT NULL DEFAULT 0,
    mistakes INTEGER NOT NULL DEFAULT 0,
    hints_used INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    daily_date TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS game_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    mistakes INTEGER NOT NULL DEFAULT 0,
    hints_used INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    won INTEGER NOT NULL DEFAULT 1,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS daily_puzzles (
    daily_date TEXT PRIMARY KEY,
    difficulty TEXT NOT NULL,
    puzzle_json TEXT NOT NULL,
    solution_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS daily_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    daily_date TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    mistakes INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, daily_date)
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(requester_id, addressee_id)
  );

  CREATE TABLE IF NOT EXISTS user_achievements (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, achievement_id)
  );
`);

// Security & Crypto Helpers
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function validatePasswordStrength(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      cookies[k] = v;
    }
  }
  return cookies;
}

function setSessionCookie(res: Response, token: string, req: Request) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie('playcotedoku_session', token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(res: Response, req: Request) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie('playcotedoku_session', {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
  });
}

interface DbUserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  bio: string;
  avatar_id: string;
  theme: string;
  sound_enabled: number;
  music_enabled: number;
  notifications_enabled: number;
  fast_pencil_default: number;
  xp: number;
  level: number;
  streak_days: number;
  win_streak: number;
  best_win_streak: number;
  last_daily_date: string | null;
  wins: number;
  games_played: number;
  perfect_games: number;
  best_time_easy: number | null;
  best_time_medium: number | null;
  best_time_hard: number | null;
  best_time_expert: number | null;
  created_at: string;
}

function mapUserRowToProfile(row: DbUserRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    bio: row.bio,
    avatarId: row.avatar_id,
    theme: row.theme === 'dark' ? 'dark' : 'light',
    soundEnabled: Boolean(row.sound_enabled),
    musicEnabled: Boolean(row.music_enabled),
    notificationsEnabled: Boolean(row.notifications_enabled),
    fastPencilDefault: Boolean(row.fast_pencil_default),
    xp: row.xp,
    level: row.level,
    streakDays: row.streak_days,
    winStreak: row.win_streak,
    bestWinStreak: row.best_win_streak,
    lastDailyDate: row.last_daily_date,
    wins: row.wins,
    gamesPlayed: row.games_played,
    perfectGames: row.perfect_games,
    bestTimeEasy: row.best_time_easy,
    bestTimeMedium: row.best_time_medium,
    bestTimeHard: row.best_time_hard,
    bestTimeExpert: row.best_time_expert,
    createdAt: row.created_at,
  };
}

function mapUserRowToPublic(row: DbUserRow, isOnline: boolean, friendshipStatus?: PublicPlayer['friendshipStatus']): PublicPlayer {
  return {
    id: row.id,
    username: row.username,
    bio: row.bio,
    avatarId: row.avatar_id,
    xp: row.xp,
    level: row.level,
    streakDays: row.streak_days,
    winStreak: row.win_streak,
    wins: row.wins,
    gamesPlayed: row.games_played,
    perfectGames: row.perfect_games,
    bestTimeEasy: row.best_time_easy,
    bestTimeMedium: row.best_time_medium,
    bestTimeHard: row.best_time_hard,
    bestTimeExpert: row.best_time_expert,
    isOnline,
    friendshipStatus,
  };
}

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayUtcDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getOrCreateDailyPuzzle(dateStr: string): { dailyDate: string; difficulty: Difficulty; puzzle: number[][]; solution: number[][] } {
  const existing = db.prepare('SELECT * FROM daily_puzzles WHERE daily_date = ?').get(dateStr) as
    | { daily_date: string; difficulty: Difficulty; puzzle_json: string; solution_json: string }
    | undefined;
  if (existing) {
    return {
      dailyDate: existing.daily_date,
      difficulty: existing.difficulty,
      puzzle: JSON.parse(existing.puzzle_json),
      solution: JSON.parse(existing.solution_json),
    };
  }
  const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  const difficultyRotation: Difficulty[] = ['medium', 'easy', 'medium', 'hard', 'medium', 'hard', 'expert'];
  const difficulty = difficultyRotation[dayOfWeek] || 'medium';
  const generated = generateSudoku(difficulty, `playcotedoku-daily-${dateStr}`);
  db.prepare(
    'INSERT OR IGNORE INTO daily_puzzles (daily_date, difficulty, puzzle_json, solution_json) VALUES (?, ?, ?, ?)'
  ).run(dateStr, difficulty, JSON.stringify(generated.puzzle), JSON.stringify(generated.solution));

  return {
    dailyDate: dateStr,
    difficulty,
    puzzle: generated.puzzle,
    solution: generated.solution,
  };
}

// Track Online WebSocket Presence
const onlineSockets = new Map<number, Set<WebSocket>>();

function isUserOnline(userId: number): boolean {
  const set = onlineSockets.get(userId);
  return Boolean(set && set.size > 0);
}

function sendToUser(userId: number, payload: unknown) {
  const set = onlineSockets.get(userId);
  if (!set) return;
  const raw = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  }
}

function getFriendIds(userId: number): number[] {
  const rows = db
    .prepare(
      `SELECT requester_id, addressee_id FROM friendships 
       WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)`
    )
    .all(userId, userId) as Array<{ requester_id: number; addressee_id: number }>;
  return rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
}

function broadcastPresenceToFriends(userId: number, isOnline: boolean) {
  const friendIds = getFriendIds(userId);
  for (const fid of friendIds) {
    sendToUser(fid, { type: 'presence:update', userId, isOnline });
  }
}

function awardStatsAndAchievements(params: {
  userId: number;
  mode: GameMode;
  difficulty: Difficulty;
  durationSeconds: number;
  mistakes: number;
  hintsUsed: number;
  score: number;
  won: boolean;
  dailyDate?: string | null;
}): { xpEarned: number; newlyUnlocked: string[]; updatedUser: UserProfile } {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(params.userId) as DbUserRow;
  const diffConfig = DIFFICULTY_CONFIG[params.difficulty];

  let xpEarned = 0;
  if (params.won) {
    const timeBonus = Math.max(10, Math.round(600 / Math.max(60, params.durationSeconds)) * 15);
    const accuracyBonus = params.mistakes === 0 ? 45 : Math.max(0, 30 - params.mistakes * 10);
    const modeBonus = params.mode === 'race' ? 60 : params.mode === 'coop' ? 40 : params.mode === 'daily' ? 50 : 0;
    xpEarned = Math.round(diffConfig.baseXp + timeBonus + accuracyBonus + modeBonus);
  } else {
    xpEarned = 20;
  }

  let newWins = user.wins + (params.won ? 1 : 0);
  let newGamesPlayed = user.games_played + 1;
  let newPerfectGames = user.perfect_games + (params.won && params.mistakes === 0 ? 1 : 0);
  let newWinStreak = params.won ? user.win_streak + 1 : 0;
  let newBestWinStreak = Math.max(user.best_win_streak, newWinStreak);

  let newStreakDays = user.streak_days;
  let newLastDaily = user.last_daily_date;

  if (params.mode === 'daily' && params.won && params.dailyDate) {
    const yesterday = getYesterdayUtcDate(params.dailyDate);
    if (user.last_daily_date === params.dailyDate) {
      // Already completed today
    } else if (user.last_daily_date === yesterday) {
      newStreakDays = user.streak_days + 1;
      newLastDaily = params.dailyDate;
    } else {
      newStreakDays = 1;
      newLastDaily = params.dailyDate;
    }
  }

  let bestEasy = user.best_time_easy;
  let bestMed = user.best_time_medium;
  let bestHard = user.best_time_hard;
  let bestExpert = user.best_time_expert;

  if (params.won) {
    if (params.difficulty === 'easy') bestEasy = bestEasy === null ? params.durationSeconds : Math.min(bestEasy, params.durationSeconds);
    if (params.difficulty === 'medium') bestMed = bestMed === null ? params.durationSeconds : Math.min(bestMed, params.durationSeconds);
    if (params.difficulty === 'hard') bestHard = bestHard === null ? params.durationSeconds : Math.min(bestHard, params.durationSeconds);
    if (params.difficulty === 'expert') bestExpert = bestExpert === null ? params.durationSeconds : Math.min(bestExpert, params.durationSeconds);
  }

  // Record history
  db.prepare(
    `INSERT INTO game_history (user_id, mode, difficulty, duration_seconds, mistakes, hints_used, score, won, xp_earned)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    params.userId,
    params.mode,
    params.difficulty,
    params.durationSeconds,
    params.mistakes,
    params.hintsUsed,
    params.score,
    params.won ? 1 : 0,
    xpEarned
  );

  // Check achievements
  const alreadyUnlocked = new Set(
    (db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?').all(params.userId) as Array<{ achievement_id: string }>).map(
      (r) => r.achievement_id
    )
  );
  const newlyUnlocked: string[] = [];

  const checkUnlock = (id: string, condition: boolean) => {
    if (condition && !alreadyUnlocked.has(id)) {
      alreadyUnlocked.add(id);
      newlyUnlocked.push(id);
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def) xpEarned += def.xpReward;
      db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)').run(params.userId, id);
    }
  };

  if (params.won) {
    checkUnlock('first_puzzle', newWins >= 1);
    checkUnlock('no_mistakes', params.mistakes === 0);
    checkUnlock(
      'speed_solver',
      (params.difficulty === 'medium' || params.difficulty === 'hard' || params.difficulty === 'expert') &&
        params.durationSeconds <= 240
    );
    checkUnlock('sudoku_master', params.difficulty === 'expert');
    checkUnlock('daily_devotee', params.mode === 'daily');
    checkUnlock('seven_day_streak', newStreakDays >= 7);
    checkUnlock('cozy_coop', params.mode === 'coop');
    checkUnlock('race_champion', params.mode === 'race');
    checkUnlock('ten_wins', newWins >= 10);
  }

  const totalXp = user.xp + xpEarned;
  const newLevel = getLevelFromXp(totalXp);

  db.prepare(
    `UPDATE users SET
      xp = ?, level = ?, streak_days = ?, win_streak = ?, best_win_streak = ?,
      last_daily_date = ?, wins = ?, games_played = ?, perfect_games = ?,
      best_time_easy = ?, best_time_medium = ?, best_time_hard = ?, best_time_expert = ?
     WHERE id = ?`
  ).run(
    totalXp,
    newLevel,
    newStreakDays,
    newWinStreak,
    newBestWinStreak,
    newLastDaily,
    newWins,
    newGamesPlayed,
    newPerfectGames,
    bestEasy,
    bestMed,
    bestHard,
    bestExpert,
    params.userId
  );

  const updatedRow = db.prepare('SELECT * FROM users WHERE id = ?').get(params.userId) as DbUserRow;
  return {
    xpEarned,
    newlyUnlocked,
    updatedUser: mapUserRowToProfile(updatedRow),
  };
}

// Express App Setup
const app = express();
app.use(express.json({ limit: '1mb' }));

interface AuthedRequest extends Request {
  user?: DbUserRow;
  sessionToken?: string;
}

function getUserFromToken(token?: string | null): DbUserRow | null {
  if (!token) return null;
  const session = db
    .prepare("SELECT user_id, expires_at FROM sessions WHERE token = ? AND datetime(expires_at) > datetime('now')")
    .get(token) as { user_id: number; expires_at: string } | undefined;
  if (!session) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as DbUserRow | undefined;
  return user ?? null;
}

function extractTokenFromReq(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies.playcotedoku_session || null;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractTokenFromReq(req);
  const user = getUserFromToken(token);
  if (!user || !token) {
    res.status(401).json({ error: 'Authentication required. Please log in to PLAYCOTEDOKU.' });
    return;
  }
  req.user = user;
  req.sessionToken = token;
  next();
}

// --- AUTH ROUTES ---
app.post('/api/auth/signup', (req: Request, res: Response) => {
  try {
    const username = String(req.body?.username || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const avatarId = String(req.body?.avatarId || DEFAULT_AVATAR_ID);

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      res.status(400).json({ error: 'Username must be 3–20 characters (letters, numbers, underscores only).' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    const pwErr = validatePasswordStrength(password);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existingUser) {
      res.status(409).json({ error: 'That username or email is already registered.' });
      return;
    }

    const validAvatar = CAPYBARA_AVATARS.some((a) => a.id === avatarId) ? avatarId : DEFAULT_AVATAR_ID;
    const pwHash = hashPassword(password);

    const info = db
      .prepare('INSERT INTO users (username, email, password_hash, avatar_id) VALUES (?, ?, ?, ?)')
      .run(username, email, pwHash, validAvatar);

    const userId = Number(info.lastInsertRowid);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);

    setSessionCookie(res, token, req);
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as DbUserRow;
    res.status(201).json({
      token,
      user: mapUserRowToProfile(userRow),
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Unable to create account right now.' });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const identifier = String(req.body?.identifier || req.body?.email || '').trim();
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
      res.status(400).json({ error: 'Please enter your email/username and password.' });
      return;
    }

    const userRow = db
      .prepare('SELECT * FROM users WHERE email = ? OR username = ?')
      .get(identifier.toLowerCase(), identifier) as DbUserRow | undefined;

    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      res.status(401).json({ error: 'Invalid credentials. Please check your email/username and password.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userRow.id, expiresAt);

    setSessionCookie(res, token, req);
    res.json({
      token,
      user: mapUserRowToProfile(userRow),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Unable to log in right now.' });
  }
});

app.post('/api/auth/logout', (req: AuthedRequest, res: Response) => {
  const token = extractTokenFromReq(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  clearSessionCookie(res, req);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
  const achievements = db
    .prepare('SELECT achievement_id as achievementId, unlocked_at as unlockedAt FROM user_achievements WHERE user_id = ?')
    .all(req.user!.id);
  res.json({
    user: mapUserRowToProfile(req.user!),
    achievements,
  });
});

app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Please enter your registered email address.' });
    return;
  }

  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email) as { id: number; email: string } | undefined;
  if (!user) {
    // Still return clear friendly response for testing/UX or don't leak? Actually friendly confirmation:
    res.status(404).json({ error: 'No PLAYCOTEDOKU account found with that email address.' });
    return;
  }

  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ?').run(user.id);
  db.prepare('INSERT INTO password_resets (user_id, code, expires_at) VALUES (?, ?, ?)').run(user.id, code, expiresAt);

  res.json({
    ok: true,
    message: 'A 6-digit password reset verification code has been generated.',
    // Returned when SMTP relay is not configured so users can complete reset directly
    verificationCode: process.env.SMTP_HOST ? undefined : code,
  });
});

app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  const pwErr = validatePasswordStrength(newPassword);
  if (pwErr) {
    res.status(400).json({ error: pwErr });
    return;
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (!user) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }

  const resetRow = db
    .prepare(
      "SELECT id FROM password_resets WHERE user_id = ? AND code = ? AND used = 0 AND datetime(expires_at) > datetime('now') ORDER BY id DESC LIMIT 1"
    )
    .get(user.id, code) as { id: number } | undefined;

  if (!resetRow) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  const newHash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

  res.json({ ok: true, message: 'Password updated successfully! You can now log in.' });
});

// --- PROFILE & SETTINGS ---
app.patch('/api/profile', requireAuth, (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user!;
    const updates: Partial<DbUserRow> = {};

    if (req.body.username !== undefined) {
      const nextUsername = String(req.body.username).trim();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(nextUsername)) {
        res.status(400).json({ error: 'Username must be 3–20 characters (letters, numbers, underscores).' });
        return;
      }
      const conflict = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(nextUsername, user.id);
      if (conflict) {
        res.status(409).json({ error: 'That username is already taken.' });
        return;
      }
      updates.username = nextUsername;
    }

    if (req.body.bio !== undefined) {
      updates.bio = String(req.body.bio).trim().slice(0, 140);
    }

    if (req.body.avatarId !== undefined) {
      const avId = String(req.body.avatarId);
      if (!CAPYBARA_AVATARS.some((a) => a.id === avId)) {
        res.status(400).json({ error: 'Invalid capybara avatar selection.' });
        return;
      }
      updates.avatar_id = avId;
    }

    if (req.body.theme !== undefined) {
      updates.theme = req.body.theme === 'dark' ? 'dark' : 'light';
    }
    if (req.body.soundEnabled !== undefined) updates.sound_enabled = req.body.soundEnabled ? 1 : 0;
    if (req.body.musicEnabled !== undefined) updates.music_enabled = req.body.musicEnabled ? 1 : 0;
    if (req.body.notificationsEnabled !== undefined) updates.notifications_enabled = req.body.notificationsEnabled ? 1 : 0;
    if (req.body.fastPencilDefault !== undefined) updates.fast_pencil_default = req.body.fastPencilDefault ? 1 : 0;

    const keys = Object.keys(updates) as Array<keyof DbUserRow>;
    if (keys.length > 0) {
      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      const values = keys.map((k) => updates[k]);
      db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...values, user.id);
    }

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as DbUserRow;
    res.json({ user: mapUserRowToProfile(updated) });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

app.post('/api/profile/change-password', requireAuth, (req: AuthedRequest, res: Response) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (!verifyPassword(currentPassword, req.user!.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  const pwErr = validatePasswordStrength(newPassword);
  if (pwErr) {
    res.status(400).json({ error: pwErr });
    return;
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), req.user!.id);
  res.json({ ok: true, message: 'Password updated successfully.' });
});

// --- DASHBOARD & GAMEPLAY ---
function mapSavedGameRow(row: any): SavedGame {
  return {
    id: row.id,
    userId: row.user_id,
    mode: row.mode,
    difficulty: row.difficulty,
    puzzle: JSON.parse(row.puzzle_json),
    solution: JSON.parse(row.solution_json),
    board: JSON.parse(row.board_json),
    notes: JSON.parse(row.notes_json),
    elapsedSeconds: row.elapsed_seconds,
    mistakes: row.mistakes,
    hintsUsed: row.hints_used,
    score: row.score,
    dailyDate: row.daily_date,
    updatedAt: row.updated_at,
  };
}

app.get('/api/dashboard', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const savedRows = db
    .prepare('SELECT * FROM saved_games WHERE user_id = ? ORDER BY datetime(updated_at) DESC')
    .all(userId);
  const historyRows = db
    .prepare(
      `SELECT id, mode, difficulty, duration_seconds as durationSeconds, mistakes, hints_used as hintsUsed,
              score, won, xp_earned as xpEarned, completed_at as completedAt
       FROM game_history WHERE user_id = ? ORDER BY id DESC LIMIT 12`
    )
    .all(userId) as Array<Omit<GameHistoryEntry, 'won'> & { won: number }>;

  const achievements = db
    .prepare('SELECT achievement_id as achievementId, unlocked_at as unlockedAt FROM user_achievements WHERE user_id = ?')
    .all(userId);

  const pendingRequestsCount = (
    db.prepare("SELECT COUNT(*) as cnt FROM friendships WHERE addressee_id = ? AND status = 'pending'").get(userId) as { cnt: number }
  ).cnt;

  const today = getTodayUtcDate();
  const dailyPuzzle = getOrCreateDailyPuzzle(today);
  const dailyDone = db
    .prepare('SELECT duration_seconds as durationSeconds, mistakes, score, completed_at as completedAt FROM daily_completions WHERE user_id = ? AND daily_date = ?')
    .get(userId, today);

  res.json({
    user: mapUserRowToProfile(req.user!),
    savedGames: savedRows.map(mapSavedGameRow),
    recentGames: historyRows.map((h) => ({ ...h, won: Boolean(h.won) })),
    achievements,
    pendingRequestsCount,
    dailySummary: {
      dailyDate: today,
      difficulty: dailyPuzzle.difficulty,
      completed: Boolean(dailyDone),
      completion: dailyDone || null,
    },
  });
});

app.post('/api/games/new', requireAuth, (req: AuthedRequest, res: Response) => {
  const difficulty = (['easy', 'medium', 'hard', 'expert'].includes(req.body?.difficulty)
    ? req.body.difficulty
    : 'medium') as Difficulty;

  const { puzzle, solution } = generateSudoku(difficulty);
  const board = cloneBoard(puzzle);
  const notes = createEmptyNotes();

  const info = db
    .prepare(
      `INSERT INTO saved_games (user_id, mode, difficulty, puzzle_json, solution_json, board_json, notes_json)
       VALUES (?, 'solo', ?, ?, ?, ?, ?)`
    )
    .run(req.user!.id, difficulty, JSON.stringify(puzzle), JSON.stringify(solution), JSON.stringify(board), JSON.stringify(notes));

  const saved = db.prepare('SELECT * FROM saved_games WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ game: mapSavedGameRow(saved) });
});

app.get('/api/games/daily', requireAuth, (req: AuthedRequest, res: Response) => {
  const today = getTodayUtcDate();
  const daily = getOrCreateDailyPuzzle(today);
  const userId = req.user!.id;

  let savedRow = db
    .prepare("SELECT * FROM saved_games WHERE user_id = ? AND mode = 'daily' AND daily_date = ?")
    .get(userId, today);

  const userCompletion = db
    .prepare(
      'SELECT duration_seconds as durationSeconds, mistakes, score, completed_at as completedAt FROM daily_completions WHERE user_id = ? AND daily_date = ?'
    )
    .get(userId, today) || null;

  if (!savedRow && !userCompletion) {
    const board = cloneBoard(daily.puzzle);
    const notes = createEmptyNotes();
    const info = db
      .prepare(
        `INSERT INTO saved_games (user_id, mode, difficulty, puzzle_json, solution_json, board_json, notes_json, daily_date)
         VALUES (?, 'daily', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        daily.difficulty,
        JSON.stringify(daily.puzzle),
        JSON.stringify(daily.solution),
        JSON.stringify(board),
        JSON.stringify(notes),
        today
      );
    savedRow = db.prepare('SELECT * FROM saved_games WHERE id = ?').get(info.lastInsertRowid);
  }

  const friendIds = new Set(getFriendIds(userId));
  const lbRows = db
    .prepare(
      `SELECT dc.user_id as userId, u.username, u.avatar_id as avatarId, dc.duration_seconds as durationSeconds, dc.mistakes, dc.score
       FROM daily_completions dc
       JOIN users u ON u.id = dc.user_id
       WHERE dc.daily_date = ?
       ORDER BY dc.duration_seconds ASC, dc.mistakes ASC
       LIMIT 30`
    )
    .all(today) as Array<{ userId: number; username: string; avatarId: string; durationSeconds: number; mistakes: number; score: number }>;

  res.json({
    dailyDate: today,
    difficulty: daily.difficulty,
    puzzle: daily.puzzle,
    solution: daily.solution,
    savedGame: savedRow ? mapSavedGameRow(savedRow) : null,
    userCompletion,
    leaderboard: lbRows.map((row) => ({
      ...row,
      isFriend: friendIds.has(row.userId) || row.userId === userId,
    })),
  });
});

app.put('/api/games/:id/progress', requireAuth, (req: AuthedRequest, res: Response) => {
  const gameId = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM saved_games WHERE id = ? AND user_id = ?').get(gameId, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Saved game not found.' });
    return;
  }

  const board = Array.isArray(req.body?.board) ? req.body.board : null;
  const notes = Array.isArray(req.body?.notes) ? req.body.notes : null;
  const elapsedSeconds = Math.max(0, Number(req.body?.elapsedSeconds || 0));
  const mistakes = Math.max(0, Number(req.body?.mistakes || 0));
  const hintsUsed = Math.max(0, Number(req.body?.hintsUsed || 0));
  const score = Math.max(0, Number(req.body?.score || 0));

  if (!board || !notes) {
    res.status(400).json({ error: 'Invalid board state.' });
    return;
  }

  db.prepare(
    `UPDATE saved_games SET
      board_json = ?, notes_json = ?, elapsed_seconds = ?, mistakes = ?, hints_used = ?, score = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(JSON.stringify(board), JSON.stringify(notes), elapsedSeconds, mistakes, hintsUsed, score, gameId, req.user!.id);

  res.json({ ok: true });
});

app.post('/api/games/:id/complete', requireAuth, (req: AuthedRequest, res: Response) => {
  const gameId = Number(req.params.id);
  const gameRow = db.prepare('SELECT * FROM saved_games WHERE id = ? AND user_id = ?').get(gameId, req.user!.id) as any;
  if (!gameRow) {
    res.status(404).json({ error: 'Game session not found.' });
    return;
  }

  const board = req.body?.board as number[][];
  const solution = JSON.parse(gameRow.solution_json) as number[][];
  const elapsedSeconds = Math.max(1, Number(req.body?.elapsedSeconds || gameRow.elapsed_seconds || 1));
  const mistakes = Math.max(0, Number(req.body?.mistakes ?? gameRow.mistakes ?? 0));
  const hintsUsed = Math.max(0, Number(req.body?.hintsUsed ?? gameRow.hints_used ?? 0));
  const score = Math.max(0, Number(req.body?.score ?? gameRow.score ?? 0));

  if (!board || !isBoardSolved(board, solution)) {
    res.status(400).json({ error: 'Puzzle is not yet correctly solved.' });
    return;
  }

  if (gameRow.mode === 'daily' && gameRow.daily_date) {
    db.prepare(
      `INSERT OR IGNORE INTO daily_completions (user_id, daily_date, duration_seconds, mistakes, score)
       VALUES (?, ?, ?, ?, ?)`
    ).run(req.user!.id, gameRow.daily_date, elapsedSeconds, mistakes, score);
  }

  const reward = awardStatsAndAchievements({
    userId: req.user!.id,
    mode: gameRow.mode as GameMode,
    difficulty: gameRow.difficulty as Difficulty,
    durationSeconds: elapsedSeconds,
    mistakes,
    hintsUsed,
    score,
    won: true,
    dailyDate: gameRow.daily_date,
  });

  db.prepare('DELETE FROM saved_games WHERE id = ?').run(gameId);

  res.json({
    ok: true,
    ...reward,
  });
});

app.delete('/api/games/:id', requireAuth, (req: AuthedRequest, res: Response) => {
  const gameId = Number(req.params.id);
  db.prepare('DELETE FROM saved_games WHERE id = ? AND user_id = ?').run(gameId, req.user!.id);
  res.json({ ok: true });
});

// --- FRIENDS & LEADERBOARDS ---
app.get('/api/friends', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const rows = db
    .prepare(
      `SELECT f.id as friendshipId, f.requester_id, f.addressee_id, f.status, u.*
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
       WHERE f.requester_id = ? OR f.addressee_id = ?
       ORDER BY f.updated_at DESC`
    )
    .all(userId, userId, userId) as Array<DbUserRow & { friendshipId: number; requester_id: number; addressee_id: number; status: string }>;

  const friends: PublicPlayer[] = [];
  const incoming: PublicPlayer[] = [];
  const outgoing: PublicPlayer[] = [];

  for (const r of rows) {
    const online = isUserOnline(r.id);
    if (r.status === 'accepted') {
      friends.push(mapUserRowToPublic(r, online, 'friends'));
    } else if (r.status === 'pending') {
      if (r.addressee_id === userId) {
        incoming.push(mapUserRowToPublic(r, online, 'incoming'));
      } else {
        outgoing.push(mapUserRowToPublic(r, online, 'outgoing'));
      }
    }
  }

  res.json({ friends, incoming, outgoing });
});

app.get('/api/users/search', requireAuth, (req: AuthedRequest, res: Response) => {
  const q = String(req.query.q || '').trim();
  const userId = req.user!.id;
  if (!q) {
    const recent = db
      .prepare('SELECT * FROM users WHERE id != ? ORDER BY xp DESC LIMIT 12')
      .all(userId) as DbUserRow[];
    const results = recent.map((u) => {
      const rel = db
        .prepare(
          'SELECT requester_id, addressee_id, status FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)'
        )
        .get(userId, u.id, u.id, userId) as { requester_id: number; addressee_id: number; status: string } | undefined;
      let status: PublicPlayer['friendshipStatus'] = 'none';
      if (rel) {
        status = rel.status === 'accepted' ? 'friends' : rel.requester_id === userId ? 'outgoing' : 'incoming';
      }
      return mapUserRowToPublic(u, isUserOnline(u.id), status);
    });
    res.json({ users: results });
    return;
  }

  const matched = db
    .prepare('SELECT * FROM users WHERE id != ? AND username LIKE ? ORDER BY xp DESC LIMIT 20')
    .all(userId, `%${q}%`) as DbUserRow[];

  const results = matched.map((u) => {
    const rel = db
      .prepare(
        'SELECT requester_id, addressee_id, status FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)'
      )
      .get(userId, u.id, u.id, userId) as { requester_id: number; addressee_id: number; status: string } | undefined;
    let status: PublicPlayer['friendshipStatus'] = 'none';
    if (rel) {
      status = rel.status === 'accepted' ? 'friends' : rel.requester_id === userId ? 'outgoing' : 'incoming';
    }
    return mapUserRowToPublic(u, isUserOnline(u.id), status);
  });

  res.json({ users: results });
});

app.get('/api/users/:id/profile', requireAuth, (req: AuthedRequest, res: Response) => {
  const targetId = Number(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as DbUserRow | undefined;
  if (!target) {
    res.status(404).json({ error: 'Player not found.' });
    return;
  }
  const rel = db
    .prepare(
      'SELECT requester_id, addressee_id, status FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)'
    )
    .get(req.user!.id, targetId, targetId, req.user!.id) as { requester_id: number; addressee_id: number; status: string } | undefined;
  let status: PublicPlayer['friendshipStatus'] = 'none';
  if (rel) {
    status = rel.status === 'accepted' ? 'friends' : rel.requester_id === req.user!.id ? 'outgoing' : 'incoming';
  }
  const achievements = db
    .prepare('SELECT achievement_id as achievementId, unlocked_at as unlockedAt FROM user_achievements WHERE user_id = ?')
    .all(targetId);

  res.json({
    player: mapUserRowToPublic(target, isUserOnline(targetId), status),
    achievements,
  });
});

app.post('/api/friends/request', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const targetId = Number(req.body?.targetUserId);
  if (!targetId || targetId === userId) {
    res.status(400).json({ error: 'Invalid player selected.' });
    return;
  }

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) {
    res.status(404).json({ error: 'Player not found.' });
    return;
  }

  const existing = db
    .prepare(
      'SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)'
    )
    .get(userId, targetId, targetId, userId) as { id: number; requester_id: number; status: string } | undefined;

  if (existing) {
    if (existing.status === 'accepted') {
      res.status(400).json({ error: 'You are already friends!' });
      return;
    }
    if (existing.requester_id === targetId) {
      db.prepare("UPDATE friendships SET status = 'accepted', updated_at = datetime('now') WHERE id = ?").run(existing.id);
      sendToUser(targetId, { type: 'friends:updated' });
      res.json({ ok: true, status: 'accepted' });
      return;
    }
    res.json({ ok: true, status: 'pending' });
    return;
  }

  db.prepare("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')").run(userId, targetId);
  sendToUser(targetId, {
    type: 'friends:request',
    fromUsername: req.user!.username,
    fromAvatarId: req.user!.avatar_id,
  });
  res.json({ ok: true, status: 'pending' });
});

app.post('/api/friends/respond', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const targetUserId = Number(req.body?.targetUserId);
  const accept = Boolean(req.body?.accept);

  const rel = db
    .prepare("SELECT id FROM friendships WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'")
    .get(targetUserId, userId) as { id: number } | undefined;

  if (!rel) {
    res.status(404).json({ error: 'Friend request not found.' });
    return;
  }

  if (accept) {
    db.prepare("UPDATE friendships SET status = 'accepted', updated_at = datetime('now') WHERE id = ?").run(rel.id);
    sendToUser(targetUserId, { type: 'friends:updated' });
  } else {
    db.prepare('DELETE FROM friendships WHERE id = ?').run(rel.id);
  }

  res.json({ ok: true });
});

app.delete('/api/friends/:friendId', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const friendId = Number(req.params.friendId);
  db.prepare(
    'DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)'
  ).run(userId, friendId, friendId, userId);
  sendToUser(friendId, { type: 'friends:updated' });
  res.json({ ok: true });
});

app.get('/api/leaderboards', requireAuth, (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const friendIds = getFriendIds(userId);
  const friendSet = new Set([userId, ...friendIds]);

  const globalRows = db
    .prepare('SELECT * FROM users ORDER BY xp DESC, wins DESC LIMIT 50')
    .all() as DbUserRow[];

  const global = globalRows.map((u, idx) => ({
    rank: idx + 1,
    ...mapUserRowToPublic(u, isUserOnline(u.id), friendSet.has(u.id) ? 'friends' : 'none'),
  }));

  const friendsPlaceholders = Array.from(friendSet).map(() => '?').join(',');
  const friendRows = db
    .prepare(`SELECT * FROM users WHERE id IN (${friendsPlaceholders}) ORDER BY xp DESC, wins DESC`)
    .all(...Array.from(friendSet)) as DbUserRow[];

  const friends = friendRows.map((u, idx) => ({
    rank: idx + 1,
    ...mapUserRowToPublic(u, isUserOnline(u.id), 'friends'),
  }));

  res.json({ global, friends });
});

// --- REAL-TIME MULTIPLAYER ENGINE (WebSocket) ---
interface ServerRoomParticipant {
  userId: number;
  username: string;
  avatarId: string;
  level: number;
  isHost: boolean;
  isConnected: boolean;
  raceBoard: number[][];
  raceNotes: number[][][];
  raceMistakes: number;
  raceScore: number;
  finishedAt: number | null;
  rematchReady: boolean;
}

interface ServerRoom {
  code: string;
  name: string;
  mode: 'coop' | 'race';
  difficulty: Difficulty;
  status: 'waiting' | 'playing' | 'finished';
  hostId: number;
  puzzle: number[][];
  solution: number[][];
  coopBoard: number[][];
  coopNotes: number[][][];
  coopActors: Record<string, { userId: number; username: string; avatarId: string; value: number; updatedAt: number }>;
  coopMistakes: number;
  coopScore: number;
  startedAt: number | null;
  finishedAt: number | null;
  winnerId: number | null;
  winnerUsername: string | null;
  participants: Map<number, ServerRoomParticipant>;
  chat: RoomChatMessage[];
}

const rooms = new Map<string, ServerRoom>();
const userActiveRoom = new Map<number, string>();

const COZY_ROOM_NAMES = [
  'Latte Room',
  'Mocha Match',
  'Cozy Corner',
  'Cappuccino Club',
  'Espresso Lounge',
  'Caramel Table',
  'Oat Milk Alcove',
];

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function buildRoomViewForUser(room: ServerRoom, userId: number): MultiplayerRoomView {
  const me = room.participants.get(userId);
  const participants: RoomParticipant[] = Array.from(room.participants.values()).map((p) => {
    const boardToMeasure = room.mode === 'coop' ? room.coopBoard : p.raceBoard;
    const stats = getProgressStats(room.puzzle, boardToMeasure, room.solution);
    return {
      userId: p.userId,
      username: p.username,
      avatarId: p.avatarId,
      level: p.level,
      isHost: p.isHost,
      isConnected: p.isConnected,
      progress: stats.percent,
      filledCells: stats.filledCorrect,
      totalToFill: stats.totalToFill,
      mistakes: room.mode === 'coop' ? room.coopMistakes : p.raceMistakes,
      score: room.mode === 'coop' ? room.coopScore : p.raceScore,
      finishedAt: p.finishedAt,
      rematchReady: p.rematchReady,
    };
  });

  const getMistakeCells = (b?: number[][]): string[] => {
    if (!b) return [];
    const list: string[] = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (b[r][c] !== 0 && b[r][c] !== room.solution[r][c]) {
          list.push(`${r}-${c}`);
        }
      }
    }
    return list;
  };

  return {
    code: room.code,
    name: room.name,
    mode: room.mode,
    difficulty: room.difficulty,
    status: room.status,
    hostId: room.hostId,
    puzzle: room.puzzle,
    coopBoard: room.mode === 'coop' ? room.coopBoard : undefined,
    coopNotes: room.mode === 'coop' ? room.coopNotes : undefined,
    coopActors: room.mode === 'coop' ? room.coopActors : undefined,
    coopMistakes: room.mode === 'coop' ? room.coopMistakes : undefined,
    coopScore: room.mode === 'coop' ? room.coopScore : undefined,
    coopMistakeCells: room.mode === 'coop' ? getMistakeCells(room.coopBoard) : undefined,
    myRaceBoard: room.mode === 'race' && me ? me.raceBoard : undefined,
    myRaceNotes: room.mode === 'race' && me ? me.raceNotes : undefined,
    myRaceMistakes: room.mode === 'race' && me ? me.raceMistakes : undefined,
    myRaceScore: room.mode === 'race' && me ? me.raceScore : undefined,
    myRaceMistakeCells: room.mode === 'race' && me ? getMistakeCells(me.raceBoard) : undefined,
    startedAt: room.startedAt,
    finishedAt: room.finishedAt,
    winnerId: room.winnerId,
    winnerUsername: room.winnerUsername,
    participants,
    chat: room.chat.slice(-50),
  };
}

function broadcastRoomState(room: ServerRoom) {
  for (const p of room.participants.values()) {
    if (p.isConnected) {
      sendToUser(p.userId, {
        type: 'room:state',
        room: buildRoomViewForUser(room, p.userId),
      });
    }
  }
}

function getPublicRoomListings() {
  const list: Array<{
    code: string;
    name: string;
    mode: 'coop' | 'race';
    difficulty: Difficulty;
    status: string;
    playerCount: number;
    hostUsername: string;
    hostAvatarId: string;
  }> = [];

  for (const r of rooms.values()) {
    if (r.status === 'waiting' && r.participants.size > 0) {
      const host = r.participants.get(r.hostId);
      list.push({
        code: r.code,
        name: r.name,
        mode: r.mode,
        difficulty: r.difficulty,
        status: r.status,
        playerCount: r.participants.size,
        hostUsername: host?.username || 'Host',
        hostAvatarId: host?.avatarId || DEFAULT_AVATAR_ID,
      });
    }
  }
  return list;
}

function broadcastLobbyList() {
  const listings = getPublicRoomListings();
  for (const sockets of onlineSockets.values()) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'room:list', rooms: listings }));
      }
    }
  }
}

app.get('/api/rooms', requireAuth, (_req: AuthedRequest, res: Response) => {
  res.json({ rooms: getPublicRoomListings() });
});

async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const reqUrl = new URL(req.url || '/ws', `http://${req.headers.host || 'localhost'}`);
    const queryToken = reqUrl.searchParams.get('token');
    const cookies = parseCookies(req.headers.cookie);
    const token = queryToken || cookies.playcotedoku_session;
    const userRow = getUserFromToken(token);

    if (!userRow) {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication required for real-time play.' }));
      ws.close();
      return;
    }

    const userId = userRow.id;
    let userSet = onlineSockets.get(userId);
    const wasOffline = !userSet || userSet.size === 0;
    if (!userSet) {
      userSet = new Set();
      onlineSockets.set(userId, userSet);
    }
    userSet.add(ws);

    if (wasOffline) {
      broadcastPresenceToFriends(userId, true);
    }

    // Reconnect user to active room if they were in one
    const activeCode = userActiveRoom.get(userId);
    if (activeCode) {
      const existingRoom = rooms.get(activeCode);
      const participant = existingRoom?.participants.get(userId);
      if (existingRoom && participant) {
        participant.isConnected = true;
        broadcastRoomState(existingRoom);
      } else {
        userActiveRoom.delete(userId);
      }
    }

    ws.send(JSON.stringify({ type: 'room:list', rooms: getPublicRoomListings() }));

    ws.on('message', (rawMsg) => {
      try {
        const msg = JSON.parse(rawMsg.toString());
        const latestUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as DbUserRow | undefined;
        if (!latestUser) return;

        switch (msg.type) {
          case 'room:list': {
            ws.send(JSON.stringify({ type: 'room:list', rooms: getPublicRoomListings() }));
            break;
          }

          case 'room:create': {
            const mode = msg.mode === 'race' ? 'race' : 'coop';
            const difficulty = (['easy', 'medium', 'hard', 'expert'].includes(msg.difficulty)
              ? msg.difficulty
              : 'medium') as Difficulty;
            const customName = String(msg.name || '').trim().slice(0, 32);
            const roomName = customName || COZY_ROOM_NAMES[crypto.randomInt(0, COZY_ROOM_NAMES.length)];

            // Leave any prior room cleanly
            const prevCode = userActiveRoom.get(userId);
            if (prevCode && rooms.has(prevCode)) {
              const prevRoom = rooms.get(prevCode)!;
              prevRoom.participants.delete(userId);
              if (prevRoom.participants.size === 0) rooms.delete(prevCode);
              else broadcastRoomState(prevRoom);
            }

            const { puzzle, solution } = generateSudoku(difficulty);
            const code = generateRoomCode();
            const room: ServerRoom = {
              code,
              name: roomName,
              mode,
              difficulty,
              status: 'waiting',
              hostId: userId,
              puzzle,
              solution,
              coopBoard: cloneBoard(puzzle),
              coopNotes: createEmptyNotes(),
              coopActors: {},
              coopMistakes: 0,
              coopScore: 0,
              startedAt: null,
              finishedAt: null,
              winnerId: null,
              winnerUsername: null,
              participants: new Map(),
              chat: [
                {
                  id: crypto.randomUUID(),
                  userId: 0,
                  username: 'PLAYCOTEDOKU',
                  avatarId: DEFAULT_AVATAR_ID,
                  text: `${latestUser.username} opened ${roomName} (${mode === 'coop' ? 'Co-op' : '1v1 Race'} · ${DIFFICULTY_CONFIG[difficulty].label}).`,
                  timestamp: Date.now(),
                  isSystem: true,
                },
              ],
            };

            room.participants.set(userId, {
              userId,
              username: latestUser.username,
              avatarId: latestUser.avatar_id,
              level: latestUser.level,
              isHost: true,
              isConnected: true,
              raceBoard: cloneBoard(puzzle),
              raceNotes: createEmptyNotes(),
              raceMistakes: 0,
              raceScore: 0,
              finishedAt: null,
              rematchReady: false,
            });

            rooms.set(code, room);
            userActiveRoom.set(userId, code);
            broadcastRoomState(room);
            broadcastLobbyList();
            break;
          }

          case 'room:join': {
            const code = String(msg.code || '').trim().toUpperCase();
            const room = rooms.get(code);
            if (!room) {
              ws.send(JSON.stringify({ type: 'error', message: `Room "${code}" was not found.` }));
              return;
            }
            if (room.mode === 'race' && room.participants.size >= 2 && !room.participants.has(userId)) {
              ws.send(JSON.stringify({ type: 'error', message: 'This 1v1 Race table already has 2 players.' }));
              return;
            }

            const prevCode = userActiveRoom.get(userId);
            if (prevCode && prevCode !== code && rooms.has(prevCode)) {
              const prevRoom = rooms.get(prevCode)!;
              prevRoom.participants.delete(userId);
              if (prevRoom.participants.size === 0) rooms.delete(prevCode);
              else broadcastRoomState(prevRoom);
            }

            let participant = room.participants.get(userId);
            if (!participant) {
              participant = {
                userId,
                username: latestUser.username,
                avatarId: latestUser.avatar_id,
                level: latestUser.level,
                isHost: false,
                isConnected: true,
                raceBoard: cloneBoard(room.puzzle),
                raceNotes: createEmptyNotes(),
                raceMistakes: 0,
                raceScore: 0,
                finishedAt: null,
                rematchReady: false,
              };
              room.participants.set(userId, participant);
              room.chat.push({
                id: crypto.randomUUID(),
                userId: 0,
                username: 'PLAYCOTEDOKU',
                avatarId: DEFAULT_AVATAR_ID,
                text: `${latestUser.username} pulled up a chair at the table.`,
                timestamp: Date.now(),
                isSystem: true,
              });
            } else {
              participant.isConnected = true;
              participant.username = latestUser.username;
              participant.avatarId = latestUser.avatar_id;
            }

            userActiveRoom.set(userId, code);
            broadcastRoomState(room);
            broadcastLobbyList();
            break;
          }

          case 'room:leave': {
            const code = userActiveRoom.get(userId);
            if (!code) break;
            const room = rooms.get(code);
            userActiveRoom.delete(userId);
            if (!room) break;
            room.participants.delete(userId);
            if (room.participants.size === 0) {
              rooms.delete(code);
            } else {
              if (room.hostId === userId) {
                const nextHost = room.participants.values().next().value;
                if (nextHost) {
                  nextHost.isHost = true;
                  room.hostId = nextHost.userId;
                }
              }
              room.chat.push({
                id: crypto.randomUUID(),
                userId: 0,
                username: 'PLAYCOTEDOKU',
                avatarId: DEFAULT_AVATAR_ID,
                text: `${latestUser.username} left the table.`,
                timestamp: Date.now(),
                isSystem: true,
              });
              broadcastRoomState(room);
            }
            ws.send(JSON.stringify({ type: 'room:left' }));
            broadcastLobbyList();
            break;
          }

          case 'room:start': {
            const code = userActiveRoom.get(userId);
            if (!code) break;
            const room = rooms.get(code);
            if (!room || room.hostId !== userId || room.status !== 'waiting') break;
            if (room.mode === 'race' && room.participants.size < 2) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invite or wait for an opponent to join before starting a 1v1 Race!' }));
              return;
            }
            room.status = 'playing';
            room.startedAt = Date.now();
            room.chat.push({
              id: crypto.randomUUID(),
              userId: 0,
              username: 'PLAYCOTEDOKU',
              avatarId: DEFAULT_AVATAR_ID,
              text: 'Brewing complete — puzzle started! Good luck!',
              timestamp: Date.now(),
              isSystem: true,
            });
            broadcastRoomState(room);
            broadcastLobbyList();
            break;
          }

          case 'room:move': {
            const code = userActiveRoom.get(userId);
            if (!code) break;
            const room = rooms.get(code);
            if (!room || room.status !== 'playing') break;

            const row = Number(msg.row);
            const col = Number(msg.col);
            const value = Number(msg.value); // 0 to erase, 1..9 to set
            const isPencil = Boolean(msg.isPencil);

            if (row < 0 || row > 8 || col < 0 || col > 8 || value < 0 || value > 9) break;
            if (room.puzzle[row][col] !== 0) break; // Given clue

            const participant = room.participants.get(userId);
            if (!participant) break;

            if (room.mode === 'coop') {
              if (isPencil && value >= 1 && value <= 9) {
                if (room.coopBoard[row][col] !== 0) break;
                const cellNotes = room.coopNotes[row][col];
                const idx = cellNotes.indexOf(value);
                if (idx >= 0) cellNotes.splice(idx, 1);
                else cellNotes.push(value);
                cellNotes.sort((a, b) => a - b);
              } else if (value === 0) {
                if (room.coopBoard[row][col] !== room.solution[row][col]) {
                  room.coopBoard[row][col] = 0;
                  delete room.coopActors[`${row}-${col}`];
                }
              } else {
                const prev = room.coopBoard[row][col];
                if (prev === room.solution[row][col]) break; // Lock already-correct shared cells
                room.coopBoard[row][col] = value;
                room.coopNotes[row][col] = [];
                room.coopActors[`${row}-${col}`] = {
                  userId,
                  username: latestUser.username,
                  avatarId: latestUser.avatar_id,
                  value,
                  updatedAt: Date.now(),
                };
                if (value === room.solution[row][col]) {
                  room.coopScore += Math.round(50 * DIFFICULTY_CONFIG[room.difficulty].multiplier);
                  // Clear matching note in row/col/box
                  for (let i = 0; i < 9; i++) {
                    room.coopNotes[row][i] = room.coopNotes[row][i].filter((n) => n !== value);
                    room.coopNotes[i][col] = room.coopNotes[i][col].filter((n) => n !== value);
                  }
                  const br = Math.floor(row / 3) * 3;
                  const bc = Math.floor(col / 3) * 3;
                  for (let r = br; r < br + 3; r++) {
                    for (let c = bc; c < bc + 3; c++) {
                      room.coopNotes[r][c] = room.coopNotes[r][c].filter((n) => n !== value);
                    }
                  }
                } else {
                  room.coopMistakes += 1;
                  room.coopScore = Math.max(0, room.coopScore - 15);
                }

                // Check co-op completion
                if (isBoardSolved(room.coopBoard, room.solution)) {
                  room.status = 'finished';
                  room.finishedAt = Date.now();
                  room.winnerId = userId;
                  room.winnerUsername = 'Team';
                  const durationSeconds = Math.max(1, Math.round((room.finishedAt - (room.startedAt || room.finishedAt)) / 1000));
                  for (const p of room.participants.values()) {
                    awardStatsAndAchievements({
                      userId: p.userId,
                      mode: 'coop',
                      difficulty: room.difficulty,
                      durationSeconds,
                      mistakes: room.coopMistakes,
                      hintsUsed: 0,
                      score: room.coopScore,
                      won: true,
                    });
                  }
                }
              }
              broadcastRoomState(room);
            } else {
              // 1v1 Race Mode
              if (isPencil && value >= 1 && value <= 9) {
                if (participant.raceBoard[row][col] !== 0) break;
                const cellNotes = participant.raceNotes[row][col];
                const idx = cellNotes.indexOf(value);
                if (idx >= 0) cellNotes.splice(idx, 1);
                else cellNotes.push(value);
                cellNotes.sort((a, b) => a - b);
              } else if (value === 0) {
                if (participant.raceBoard[row][col] !== room.solution[row][col]) {
                  participant.raceBoard[row][col] = 0;
                }
              } else {
                if (participant.raceBoard[row][col] === room.solution[row][col]) break;
                participant.raceBoard[row][col] = value;
                participant.raceNotes[row][col] = [];
                if (value === room.solution[row][col]) {
                  participant.raceScore += Math.round(50 * DIFFICULTY_CONFIG[room.difficulty].multiplier);
                  for (let i = 0; i < 9; i++) {
                    participant.raceNotes[row][i] = participant.raceNotes[row][i].filter((n) => n !== value);
                    participant.raceNotes[i][col] = participant.raceNotes[i][col].filter((n) => n !== value);
                  }
                  const br = Math.floor(row / 3) * 3;
                  const bc = Math.floor(col / 3) * 3;
                  for (let r = br; r < br + 3; r++) {
                    for (let c = bc; c < bc + 3; c++) {
                      participant.raceNotes[r][c] = participant.raceNotes[r][c].filter((n) => n !== value);
                    }
                  }
                } else {
                  participant.raceMistakes += 1;
                  participant.raceScore = Math.max(0, participant.raceScore - 15);
                }

                if (isBoardSolved(participant.raceBoard, room.solution)) {
                  participant.finishedAt = Date.now();
                  room.status = 'finished';
                  room.finishedAt = Date.now();
                  room.winnerId = userId;
                  room.winnerUsername = participant.username;
                  const durationSeconds = Math.max(1, Math.round((room.finishedAt - (room.startedAt || room.finishedAt)) / 1000));
                  for (const p of room.participants.values()) {
                    awardStatsAndAchievements({
                      userId: p.userId,
                      mode: 'race',
                      difficulty: room.difficulty,
                      durationSeconds,
                      mistakes: p.raceMistakes,
                      hintsUsed: 0,
                      score: p.raceScore,
                      won: p.userId === userId,
                    });
                  }
                }
              }
              broadcastRoomState(room);
            }
            break;
          }

          case 'room:chat': {
            const code = userActiveRoom.get(userId);
            if (!code) break;
            const room = rooms.get(code);
            if (!room) break;
            const text = String(msg.text || '').trim().slice(0, 220);
            if (!text) break;
            room.chat.push({
              id: crypto.randomUUID(),
              userId,
              username: latestUser.username,
              avatarId: latestUser.avatar_id,
              text,
              timestamp: Date.now(),
            });
            broadcastRoomState(room);
            break;
          }

          case 'room:rematch': {
            const code = userActiveRoom.get(userId);
            if (!code) break;
            const room = rooms.get(code);
            if (!room || room.status !== 'finished') break;
            const participant = room.participants.get(userId);
            if (!participant) break;
            participant.rematchReady = true;

            const allReady = Array.from(room.participants.values()).every((p) => !p.isConnected || p.rematchReady);
            if (allReady) {
              const { puzzle, solution } = generateSudoku(room.difficulty);
              room.puzzle = puzzle;
              room.solution = solution;
              room.coopBoard = cloneBoard(puzzle);
              room.coopNotes = createEmptyNotes();
              room.coopActors = {};
              room.coopMistakes = 0;
              room.coopScore = 0;
              room.status = 'playing';
              room.startedAt = Date.now();
              room.finishedAt = null;
              room.winnerId = null;
              room.winnerUsername = null;
              for (const p of room.participants.values()) {
                p.raceBoard = cloneBoard(puzzle);
                p.raceNotes = createEmptyNotes();
                p.raceMistakes = 0;
                p.raceScore = 0;
                p.finishedAt = null;
                p.rematchReady = false;
              }
              room.chat.push({
                id: crypto.randomUUID(),
                userId: 0,
                username: 'PLAYCOTEDOKU',
                avatarId: DEFAULT_AVATAR_ID,
                text: 'Fresh coffee poured! Rematch started with a brand-new puzzle.',
                timestamp: Date.now(),
                isSystem: true,
              });
            }
            broadcastRoomState(room);
            break;
          }

          case 'invite:send': {
            const targetUserId = Number(msg.targetUserId);
            const code = userActiveRoom.get(userId);
            if (!code || !targetUserId) break;
            const room = rooms.get(code);
            if (!room) break;
            sendToUser(targetUserId, {
              type: 'invite:received',
              invite: {
                roomCode: room.code,
                roomName: room.name,
                mode: room.mode,
                difficulty: room.difficulty,
                fromUserId: userId,
                fromUsername: latestUser.username,
                fromAvatarId: latestUser.avatar_id,
                sentAt: Date.now(),
              },
            });
            break;
          }
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      const set = onlineSockets.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          onlineSockets.delete(userId);
          broadcastPresenceToFriends(userId, false);
          const code = userActiveRoom.get(userId);
          if (code && rooms.has(code)) {
            const room = rooms.get(code)!;
            const p = room.participants.get(userId);
            if (p) {
              p.isConnected = false;
              broadcastRoomState(room);
            }
          }
        }
      }
    });
  });

  // Vite Dev Middleware or Static Production Build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PLAYCOTEDOKU server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
