import React, { useEffect, useState } from 'react';
import {
  Award,
  Calendar,
  ChevronRight,
  Clock,
  Coffee,
  Flame,
  Play,
  Swords,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { Difficulty, GameHistoryEntry, SavedGame, UnlockedAchievement, UserProfile } from '../shared/types';
import { DIFFICULTY_CONFIG, getProgressStats } from '../shared/sudoku';
import { ACHIEVEMENTS, getLevelProgress } from '../shared/achievements';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { CapyAvatarImg, formatDuration } from './BrandMark';

interface DashboardData {
  user: UserProfile;
  savedGames: SavedGame[];
  recentGames: GameHistoryEntry[];
  achievements: UnlockedAchievement[];
  pendingRequestsCount: number;
  dailySummary: {
    dailyDate: string;
    difficulty: Difficulty;
    completed: boolean;
  };
}

interface DashboardViewProps {
  onStartSolo: (difficulty: Difficulty) => void;
  onResumeGame: (game: SavedGame) => void;
  onOpenDaily: () => void;
  onNavigate: (tab: 'multiplayer' | 'friends' | 'leaderboard' | 'achievements' | 'settings') => void;
}

export function DashboardView({
  onStartSolo,
  onResumeGame,
  onOpenDaily,
  onNavigate,
}: DashboardViewProps) {
  const { user, friendSignal } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<Difficulty>('medium');
  const [loading, setLoading] = useState(true);

  const loadDashboard = () => {
    apiRequest<DashboardData>('/api/dashboard')
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, [friendSignal]);

  const handleDeleteSaved = async (id: number) => {
    await apiRequest(`/api/games/${id}`, { method: 'DELETE' }).catch(() => {});
    loadDashboard();
  };

  const activeUser = data?.user || user;
  if (!activeUser) return null;

  const levelInfo = getLevelProgress(activeUser.xp);
  const winRate =
    activeUser.gamesPlayed > 0 ? Math.round((activeUser.wins / activeUser.gamesPlayed) * 100) : 0;

  return (
    <div className="space-y-8 pb-8">
      {/* Welcome Banner */}
      <section className="p-6 sm:p-8 rounded-3xl bg-[#E8D5BC]/65 dark:bg-[#29201B] border border-[#B98B68]/30 dark:border-[#3D3028] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              title="Change Capybara Avatar"
              className="group relative shrink-0 cursor-pointer"
            >
              <CapyAvatarImg
                avatarId={activeUser.avatarId}
                sizeClass="w-16 h-16 sm:w-20 sm:h-20"
                className="ring-2 ring-[#B98B68] dark:ring-[#C99A75] group-hover:scale-[1.03] transition-transform"
              />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">
                Welcome back to the cafe
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#49382D] dark:text-[#F5EBDD] truncate">
                {activeUser.username}
              </h1>
              <p className="text-sm text-[#49382D]/80 dark:text-[#D2C2B0] mt-0.5 line-clamp-1">
                {activeUser.bio}
              </p>
            </div>
          </div>

          {/* Level & Daily Streak Cluster */}
          <div className="grid grid-cols-2 sm:flex items-center gap-4">
            <div className="px-4 py-3 rounded-2xl bg-[#FCF8F2] dark:bg-[#352A23] border border-[#E8D5BC] dark:border-[#49382D] min-w-[175px]">
              <div className="flex items-center justify-between text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">
                <span>Level {levelInfo.level}</span>
                <span className="font-mono-tabular">{activeUser.xp} XP</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#E8D5BC] dark:bg-[#1E1713] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#76533D] dark:bg-[#C99A75]"
                  style={{ width: `${levelInfo.percent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-[#76533D]/80 dark:text-[#D2C2B0] font-mono-tabular">
                {levelInfo.currentLevelXp}/{levelInfo.nextLevelXp} to Lv {levelInfo.level + 1}
              </p>
            </div>

            <div className="px-4 py-3 rounded-2xl bg-[#FCF8F2] dark:bg-[#352A23] border border-[#E8D5BC] dark:border-[#49382D] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B98B68]/20 text-[#76533D] dark:text-[#C99A75] flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[#76533D] dark:text-[#C99A75] font-semibold">Daily Streak</p>
                <p className="font-mono-tabular font-extrabold text-xl text-[#49382D] dark:text-[#F5EBDD]">
                  {activeUser.streakDays}d
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Play Modes */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Play Solo Card */}
        <div className="lg:col-span-6 p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#E8D5BC] dark:bg-[#352A23] text-[#76533D] dark:text-[#C99A75] flex items-center justify-center">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-[#49382D] dark:text-[#F5EBDD]">Play Solo</h2>
                  <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">
                    Unique-solution puzzles with Fast Pencil & auto-save
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setSelectedDiff(diff)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    selectedDiff === diff
                      ? 'bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713]'
                      : 'bg-[#F7F0E5] dark:bg-[#352A23] text-[#49382D] dark:text-[#D2C2B0] hover:bg-[#E8D5BC]/70'
                  }`}
                >
                  {DIFFICULTY_CONFIG[diff].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">
              {DIFFICULTY_CONFIG[selectedDiff].description}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onStartSolo(selectedDiff)}
            className="w-full py-3.5 px-5 rounded-xl bg-[#76533D] hover:bg-[#5E412F] dark:bg-[#C99A75] dark:hover:bg-[#B98B68] text-[#F7F0E5] dark:text-[#1E1713] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>Start {DIFFICULTY_CONFIG[selectedDiff].label} Puzzle</span>
          </button>
        </div>

        {/* Daily Challenge & Multiplayer Split */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#E8D5BC] dark:bg-[#352A23] text-[#76533D] dark:text-[#C99A75] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <h2 className="font-display text-xl font-bold text-[#49382D] dark:text-[#F5EBDD]">Daily Challenge</h2>
              <p className="text-xs text-[#76533D] dark:text-[#D2C2B0] leading-relaxed">
                {data?.dailySummary.completed
                  ? `Today's ${DIFFICULTY_CONFIG[data.dailySummary.difficulty].label} brew is complete! Compare times with friends.`
                  : `Today's shared puzzle (${data ? DIFFICULTY_CONFIG[data.dailySummary.difficulty].label : 'Medium'}) is waiting for your streak.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenDaily}
              className="w-full py-3 px-4 rounded-xl bg-[#B98B68] hover:bg-[#9E7251] text-[#2F221A] dark:text-[#1E1713] font-bold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>{data?.dailySummary.completed ? 'View Daily Standings' : 'Play Daily Brew'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#E8D5BC] dark:bg-[#352A23] text-[#76533D] dark:text-[#C99A75] flex items-center justify-center">
                <Swords className="w-5 h-5" />
              </div>
              <h2 className="font-display text-xl font-bold text-[#49382D] dark:text-[#F5EBDD]">Multiplayer</h2>
              <p className="text-xs text-[#76533D] dark:text-[#D2C2B0] leading-relaxed">
                Solve side-by-side in a Co-op room or challenge a friend to a real-time 1v1 speed race.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('multiplayer')}
              className="w-full py-3 px-4 rounded-xl bg-[#E8D5BC] hover:bg-[#DEC3A1] dark:bg-[#352A23] dark:hover:bg-[#46382E] text-[#49382D] dark:text-[#F5EBDD] font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Enter Cafe Lobby</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Unfinished Saved Games (Resume) */}
      {data && data.savedGames.length > 0 && (
        <section className="p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#49382D] dark:text-[#F5EBDD]">
              Resume Unfinished Puzzles
            </h2>
            <span className="text-xs text-[#76533D] dark:text-[#C99A75] font-mono-tabular">
              {data.savedGames.length} saved
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.savedGames.map((sg) => {
              const prog = getProgressStats(sg.puzzle, sg.board, sg.solution);
              return (
                <div
                  key={sg.id}
                  className="p-4 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23] border border-[#E8D5BC] dark:border-[#49382D] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm text-[#49382D] dark:text-[#F5EBDD]">
                      {sg.mode === 'daily' ? 'Daily Challenge' : `${DIFFICULTY_CONFIG[sg.difficulty].label} Solo`}
                    </p>
                    <p className="text-xs text-[#76533D] dark:text-[#D2C2B0] font-mono-tabular mt-0.5">
                      {prog.percent}% solved · {formatDuration(sg.elapsedSeconds)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onResumeGame(sg)}
                      className="px-3 py-2 rounded-xl bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713] text-xs font-semibold cursor-pointer"
                    >
                      Resume
                    </button>
                    {sg.mode === 'solo' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSaved(sg.id)}
                        aria-label="Discard saved game"
                        className="p-2 rounded-xl text-[#76533D] hover:text-red-700 hover:bg-red-100/70 dark:hover:bg-red-950/40 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Game Statistics Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028]">
          <p className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">Puzzles Won</p>
          <p className="font-mono-tabular text-2xl font-extrabold text-[#49382D] dark:text-[#F5EBDD] mt-1">
            {activeUser.wins}
          </p>
          <p className="text-xs text-[#76533D]/80 dark:text-[#D2C2B0] mt-0.5 font-mono-tabular">
            {winRate}% completion
          </p>
        </div>
        <div className="p-5 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028]">
          <p className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">Zero-Mistake Solves</p>
          <p className="font-mono-tabular text-2xl font-extrabold text-[#49382D] dark:text-[#F5EBDD] mt-1">
            {activeUser.perfectGames}
          </p>
          <p className="text-xs text-[#76533D]/80 dark:text-[#D2C2B0] mt-0.5">Pure Pour-Overs</p>
        </div>
        <div className="p-5 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028]">
          <p className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">Best Win Streak</p>
          <p className="font-mono-tabular text-2xl font-extrabold text-[#49382D] dark:text-[#F5EBDD] mt-1">
            {activeUser.bestWinStreak}
          </p>
          <p className="text-xs text-[#76533D]/80 dark:text-[#D2C2B0] mt-0.5">
            Current: {activeUser.winStreak}
          </p>
        </div>
        <div className="p-5 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028]">
          <p className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">Achievements</p>
          <p className="font-mono-tabular text-2xl font-extrabold text-[#49382D] dark:text-[#F5EBDD] mt-1">
            {data ? data.achievements.length : 0}/{ACHIEVEMENTS.length}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('achievements')}
            className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75] underline mt-0.5 cursor-pointer"
          >
            View badges
          </button>
        </div>
      </section>

      {/* Bottom Row: Recent Games & Quick Social Links */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#49382D] dark:text-[#F5EBDD] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#B98B68]" />
              <span>Recent Games</span>
            </h2>
            {loading && <span className="text-xs text-[#76533D]">Loading...</span>}
          </div>

          {!data || data.recentGames.length === 0 ? (
            <p className="text-sm text-[#76533D] dark:text-[#D2C2B0] py-6 text-center">
              Your recent completed games will appear here after your first puzzle!
            </p>
          ) : (
            <div className="divide-y divide-[#E8D5BC]/60 dark:divide-[#3D3028]">
              {data.recentGames.slice(0, 6).map((g) => (
                <div key={g.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-[#49382D] dark:text-[#F5EBDD] capitalize">
                      {g.mode} · {g.difficulty}
                    </p>
                    <p className="text-xs text-[#76533D] dark:text-[#D2C2B0] font-mono-tabular">
                      {formatDuration(g.durationSeconds)} · {g.mistakes} mistakes · {g.score} pts
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-bold ${
                        g.won ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#76533D] dark:text-[#D2C2B0]'
                      }`}
                    >
                      {g.won ? 'Solved' : 'Finished'}
                    </span>
                    <p className="text-xs font-mono-tabular text-[#76533D] dark:text-[#C99A75]">+{g.xpEarned} XP</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-4">
          <button
            type="button"
            onClick={() => onNavigate('friends')}
            className="w-full p-5 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] hover:border-[#B98B68] text-left flex items-center justify-between gap-4 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#E8D5BC] dark:bg-[#352A23] text-[#76533D] dark:text-[#C99A75] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-[#49382D] dark:text-[#F5EBDD]">
                  Friends & Community
                </h3>
                <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">
                  {data && data.pendingRequestsCount > 0
                    ? `${data.pendingRequestsCount} pending friend request(s)`
                    : 'Search players, view profiles & invite friends'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#76533D] dark:text-[#C99A75]" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('leaderboard')}
            className="w-full p-5 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] hover:border-[#B98B68] text-left flex items-center justify-between gap-4 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#E8D5BC] dark:bg-[#352A23] text-[#76533D] dark:text-[#C99A75] flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-[#49382D] dark:text-[#F5EBDD]">
                  Leaderboards
                </h3>
                <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">
                  Global rankings and Friends leaderboard
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#76533D] dark:text-[#C99A75]" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('achievements')}
            className="w-full p-5 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] hover:border-[#B98B68] text-left flex items-center justify-between gap-4 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#E8D5BC] dark:bg-[#352A23] text-[#76533D] dark:text-[#C99A75] flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-[#49382D] dark:text-[#F5EBDD]">
                  Badges & Records
                </h3>
                <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">
                  View personal best times and XP rewards
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#76533D] dark:text-[#C99A75]" />
          </button>
        </div>
      </section>
    </div>
  );
}
