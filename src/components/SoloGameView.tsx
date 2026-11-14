import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Award, Calendar, CheckCircle2, Clock, Sparkles, Trophy } from 'lucide-react';
import { DailyChallengeInfo, Difficulty, SavedGame, UserProfile } from '../shared/types';
import { DIFFICULTY_CONFIG } from '../shared/sudoku';
import { ACHIEVEMENTS } from '../shared/achievements';
import { apiRequest } from '../utils/api';
import { playPuzzleStartSound, playVictorySound, unlockAudio } from '../utils/sound';
import { useAuth } from '../context/AuthContext';
import { CapyAvatarImg, formatDuration } from './BrandMark';
import { SudokuBoard } from './SudokuBoard';

interface SoloGameViewProps {
  mode: 'solo' | 'daily';
  initialSavedGame?: SavedGame | null;
  initialDifficulty?: Difficulty;
  onExit: () => void;
}

export function SoloGameView({
  mode,
  initialSavedGame = null,
  initialDifficulty = 'medium',
  onExit,
}: SoloGameViewProps) {
  const { user, refreshUser } = useAuth();
  const [game, setGame] = useState<SavedGame | null>(initialSavedGame);
  const [dailyInfo, setDailyInfo] = useState<DailyChallengeInfo | null>(null);
  const [loading, setLoading] = useState(!initialSavedGame);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [introPlaying, setIntroPlaying] = useState(false);

  const [completionModal, setCompletionModal] = useState<{
    durationSeconds: number;
    mistakes: number;
    hintsUsed: number;
    score: number;
    xpEarned: number;
    newlyUnlocked: string[];
  } | null>(null);

  const gameRef = useRef<SavedGame | null>(game);
  gameRef.current = game;
  const openedGameIdsRef = useRef<Set<number>>(new Set());

  const startNewSoloGame = useCallback(async (diff: Difficulty) => {
    unlockAudio();
    setLoading(true);
    setError(null);
    setCompletionModal(null);
    setIsPaused(false);
    try {
      const res = await apiRequest<{ game: SavedGame }>('/api/games/new', {
        method: 'POST',
        body: JSON.stringify({ difficulty: diff }),
      });
      setGame(res.game);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create puzzle.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDailyChallenge = useCallback(async () => {
    unlockAudio();
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<DailyChallengeInfo>('/api/games/daily');
      setDailyInfo(data);
      if (data.savedGame) {
        setGame(data.savedGame);
      } else {
        setGame(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Daily Challenge.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'daily') {
      loadDailyChallenge();
    } else if (!initialSavedGame) {
      startNewSoloGame(initialDifficulty);
    }
  }, [mode, initialSavedGame, initialDifficulty, loadDailyChallenge, startNewSoloGame]);

  // Play cute introductory sound once when a puzzle opens before gameplay begins
  useEffect(() => {
    if (!game) return;
    if (openedGameIdsRef.current.has(game.id)) return;
    openedGameIdsRef.current.add(game.id);

    let cancelled = false;
    setIntroPlaying(true);
    playPuzzleStartSound().then(() => {
      if (!cancelled) {
        setIntroPlaying(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [game?.id]);

  // Live timer
  useEffect(() => {
    if (!game || isPaused || completionModal || introPlaying) return;
    const interval = window.setInterval(() => {
      setGame((prev) => (prev ? { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 } : null));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [game?.id, isPaused, completionModal, introPlaying]);

  // Save progress periodically & on unmount
  const persistProgress = useCallback(async (snapshot: SavedGame | null) => {
    if (!snapshot) return;
    try {
      await apiRequest(`/api/games/${snapshot.id}/progress`, {
        method: 'PUT',
        body: JSON.stringify({
          board: snapshot.board,
          notes: snapshot.notes,
          elapsedSeconds: snapshot.elapsedSeconds,
          mistakes: snapshot.mistakes,
          hintsUsed: snapshot.hintsUsed,
          score: snapshot.score,
        }),
      });
    } catch {
      // silent autosave
    }
  }, []);

  useEffect(() => {
    if (!game || completionModal) return;
    const saveTimer = window.setInterval(() => {
      persistProgress(gameRef.current);
    }, 6000);
    return () => {
      window.clearInterval(saveTimer);
      persistProgress(gameRef.current);
    };
  }, [game?.id, completionModal, persistProgress]);

  const handleLocalChange = (next: {
    board: number[][];
    notes: number[][][];
    mistakes: number;
    hintsUsed: number;
    score: number;
  }) => {
    setGame((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...next };
      // Immediate save on board change
      persistProgress(updated);
      return updated;
    });
  };

  const handleSolved = async (finalState: {
    board: number[][];
    mistakes: number;
    hintsUsed: number;
    score: number;
    elapsedSeconds: number;
  }) => {
    if (!game) return;
    playVictorySound();
    try {
      const res = await apiRequest<{
        ok: boolean;
        xpEarned: number;
        newlyUnlocked: string[];
        updatedUser: UserProfile;
      }>(`/api/games/${game.id}/complete`, {
        method: 'POST',
        body: JSON.stringify(finalState),
      });
      await refreshUser();
      if (mode === 'daily') {
        loadDailyChallenge();
      }
      setCompletionModal({
        durationSeconds: finalState.elapsedSeconds,
        mistakes: finalState.mistakes,
        hintsUsed: finalState.hintsUsed,
        score: finalState.score,
        xpEarned: res.xpEarned,
        newlyUnlocked: res.newlyUnlocked,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record completion.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <p className="font-display text-xl font-bold text-[#76533D] dark:text-[#C99A75]">
          Brewing your Sudoku board...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
        <button
          type="button"
          onClick={onExit}
          className="px-5 py-2.5 rounded-xl bg-[#76533D] text-[#F7F0E5] font-semibold text-sm cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Top Sub-Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            persistProgress(gameRef.current);
            onExit();
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#E8D5BC]/70 dark:bg-[#352A23] hover:bg-[#E8D5BC] text-[#49382D] dark:text-[#F5EBDD] text-sm font-semibold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        {mode === 'daily' && dailyInfo && (
          <div className="flex items-center gap-2 text-sm text-[#76533D] dark:text-[#C99A75] font-semibold">
            <Calendar className="w-4 h-4" />
            <span>Daily Challenge · {dailyInfo.dailyDate}</span>
            <span aria-hidden="true">·</span>
            <span>{DIFFICULTY_CONFIG[dailyInfo.difficulty].label}</span>
          </div>
        )}
      </div>

      {/* Daily Challenge Already Completed View */}
      {mode === 'daily' && dailyInfo?.userCompletion && !game && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-[#49382D] dark:text-[#F5EBDD]">
                Today&apos;s Daily Brew Complete!
              </h2>
              <p className="text-sm text-[#76533D] dark:text-[#D2C2B0] mt-1">
                Your streak is at <strong className="font-mono-tabular">{user?.streakDays || 1} day(s)</strong>. Come back tomorrow for a fresh puzzle!
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
              <div className="p-3 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23]">
                <p className="text-xs text-[#76533D] dark:text-[#C99A75]">Time</p>
                <p className="font-mono-tabular font-bold text-lg text-[#49382D] dark:text-[#F5EBDD]">
                  {formatDuration(dailyInfo.userCompletion.durationSeconds)}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23]">
                <p className="text-xs text-[#76533D] dark:text-[#C99A75]">Mistakes</p>
                <p className="font-mono-tabular font-bold text-lg text-[#49382D] dark:text-[#F5EBDD]">
                  {dailyInfo.userCompletion.mistakes}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23]">
                <p className="text-xs text-[#76533D] dark:text-[#C99A75]">Score</p>
                <p className="font-mono-tabular font-bold text-lg text-[#49382D] dark:text-[#F5EBDD]">
                  {dailyInfo.userCompletion.score}
                </p>
              </div>
            </div>
          </div>

          {/* Daily Standings Comparison */}
          <div className="p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm">
            <h3 className="font-display text-lg font-bold text-[#49382D] dark:text-[#F5EBDD] mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#B98B68]" />
              <span>Today&apos;s Fastest Solvers</span>
            </h3>
            {dailyInfo.leaderboard.length === 0 ? (
              <p className="text-sm text-[#76533D] dark:text-[#D2C2B0]">No completions recorded yet today.</p>
            ) : (
              <div className="divide-y divide-[#E8D5BC]/60 dark:divide-[#3D3028]">
                {dailyInfo.leaderboard.map((entry, idx) => (
                  <div key={entry.userId} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 font-mono-tabular font-bold text-sm text-[#76533D] dark:text-[#C99A75]">
                        #{idx + 1}
                      </span>
                      <CapyAvatarImg avatarId={entry.avatarId} sizeClass="w-9 h-9" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[#49382D] dark:text-[#F5EBDD] truncate">
                          {entry.username}
                          {entry.userId === user?.id ? ' (You)' : entry.isFriend ? ' · Friend' : ''}
                        </p>
                        <p className="text-xs text-[#76533D] dark:text-[#D2C2B0] font-mono-tabular">
                          {entry.mistakes} mistakes · {entry.score} pts
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono-tabular font-bold text-sm text-[#49382D] dark:text-[#F5EBDD]">
                      <Clock className="w-3.5 h-3.5 text-[#B98B68]" />
                      <span>{formatDuration(entry.durationSeconds)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Game Board */}
      {game && (
        <SudokuBoard
          mode={mode}
          difficulty={game.difficulty}
          puzzle={game.puzzle}
          solution={game.solution}
          board={game.board}
          notes={game.notes}
          elapsedSeconds={game.elapsedSeconds}
          mistakes={game.mistakes}
          hintsUsed={game.hintsUsed}
          score={game.score}
          fastPencilDefault={user?.fastPencilDefault}
          isPaused={isPaused}
          readOnly={introPlaying}
          onTogglePause={() => setIsPaused((p) => !p)}
          onNewGame={mode === 'solo' ? startNewSoloGame : undefined}
          onLocalStateChange={handleLocalChange}
          onSolved={handleSolved}
        />
      )}

      {/* Completion Victory Modal */}
      {completionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] p-6 sm:p-8 shadow-xl space-y-5 text-center">
            <div className="flex justify-center">
              <CapyAvatarImg avatarId={user?.avatarId} sizeClass="w-20 h-20" className="ring-4 ring-[#B98B68]/40" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-extrabold text-[#49382D] dark:text-[#F5EBDD]">
                Puzzle Solved!
              </h2>
              <p className="text-sm text-[#76533D] dark:text-[#D2C2B0] mt-1">
                Nicely brewed, {user?.username}! You earned <strong className="font-mono-tabular text-[#76533D] dark:text-[#C99A75]">+{completionModal.xpEarned} XP</strong>.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23]">
                <p className="text-xs text-[#76533D] dark:text-[#C99A75]">Time</p>
                <p className="font-mono-tabular font-bold text-base text-[#49382D] dark:text-[#F5EBDD]">
                  {formatDuration(completionModal.durationSeconds)}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23]">
                <p className="text-xs text-[#76533D] dark:text-[#C99A75]">Mistakes</p>
                <p className="font-mono-tabular font-bold text-base text-[#49382D] dark:text-[#F5EBDD]">
                  {completionModal.mistakes}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23]">
                <p className="text-xs text-[#76533D] dark:text-[#C99A75]">Score</p>
                <p className="font-mono-tabular font-bold text-base text-[#49382D] dark:text-[#F5EBDD]">
                  {completionModal.score}
                </p>
              </div>
            </div>

            {completionModal.newlyUnlocked.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#E8D5BC]/65 dark:bg-[#352A23] text-left space-y-2">
                <p className="text-xs font-bold text-[#76533D] dark:text-[#C99A75] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>New Achievements Unlocked!</span>
                </p>
                {completionModal.newlyUnlocked.map((achId) => {
                  const def = ACHIEVEMENTS.find((a) => a.id === achId);
                  if (!def) return null;
                  return (
                    <div key={achId} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#49382D] dark:text-[#F5EBDD] flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-[#B98B68]" />
                        {def.title}
                      </span>
                      <span className="font-mono-tabular text-[#76533D] dark:text-[#C99A75]">+{def.xpReward} XP</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              {mode === 'solo' && (
                <button
                  type="button"
                  onClick={() => startNewSoloGame(game?.difficulty || 'medium')}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#76533D] hover:bg-[#5E412F] dark:bg-[#C99A75] dark:hover:bg-[#B98B68] text-[#F7F0E5] dark:text-[#1E1713] font-semibold text-sm cursor-pointer"
                >
                  Play Again
                </button>
              )}
              <button
                type="button"
                onClick={onExit}
                className="flex-1 py-3 px-4 rounded-xl bg-[#E8D5BC] dark:bg-[#352A23] hover:bg-[#B98B68]/40 text-[#49382D] dark:text-[#F5EBDD] font-semibold text-sm cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
