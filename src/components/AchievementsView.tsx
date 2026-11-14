import React from 'react';
import { Award, Calendar, CheckCircle2, Coffee, Crown, Flame, Lock, Sparkles, Trophy, Users, Zap } from 'lucide-react';
import { ACHIEVEMENTS, getLevelProgress } from '../shared/achievements';
import { useAuth } from '../context/AuthContext';
import { formatDuration } from './BrandMark';

function AchievementIcon({ iconKey }: { iconKey: string }) {
  switch (iconKey) {
    case 'coffee':
      return <Coffee className="w-5 h-5" />;
    case 'sparkles':
      return <Sparkles className="w-5 h-5" />;
    case 'zap':
      return <Zap className="w-5 h-5" />;
    case 'crown':
      return <Crown className="w-5 h-5" />;
    case 'flame':
      return <Flame className="w-5 h-5" />;
    case 'calendar':
      return <Calendar className="w-5 h-5" />;
    case 'users':
      return <Users className="w-5 h-5" />;
    case 'trophy':
      return <Trophy className="w-5 h-5" />;
    default:
      return <Award className="w-5 h-5" />;
  }
}

export function AchievementsView() {
  const { user, achievements } = useAuth();
  if (!user) return null;

  const unlockedMap = new Map(achievements.map((a) => [a.achievementId, a.unlockedAt]));
  const levelInfo = getLevelProgress(user.xp);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#49382D] dark:text-[#F5EBDD]">
          Achievements & Personal Records
        </h1>
        <p className="text-sm text-[#76533D] dark:text-[#D2C2B0] mt-1">
          Collect cozy badges, build your daily brew streak, and climb player levels.
        </p>
      </div>

      {/* XP & Streaks Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 rounded-3xl bg-[#E8D5BC]/65 dark:bg-[#29201B] border border-[#B98B68]/30 dark:border-[#3D3028] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">Barista Level</span>
            <span className="font-mono-tabular text-xs font-bold text-[#49382D] dark:text-[#F5EBDD]">
              {user.xp} Total XP
            </span>
          </div>
          <p className="font-display text-3xl font-extrabold text-[#49382D] dark:text-[#F5EBDD]">
            Level {levelInfo.level}
          </p>
          <div className="h-2.5 rounded-full bg-[#FCF8F2] dark:bg-[#1E1713] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#76533D] dark:bg-[#C99A75]"
              style={{ width: `${levelInfo.percent}%` }}
            />
          </div>
          <p className="text-xs text-[#76533D] dark:text-[#D2C2B0] font-mono-tabular">
            {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP to Level {levelInfo.level + 1}
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] space-y-2">
          <p className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">Daily & Win Streaks</p>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <p className="font-mono-tabular text-2xl font-extrabold text-[#49382D] dark:text-[#F5EBDD]">
                {user.streakDays}d
              </p>
              <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">Daily Streak</p>
            </div>
            <div>
              <p className="font-mono-tabular text-2xl font-extrabold text-[#49382D] dark:text-[#F5EBDD]">
                {user.bestWinStreak}
              </p>
              <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">Best Win Streak</p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] space-y-2.5">
          <p className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">Fastest Solve Times</p>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono-tabular">
            <div className="flex justify-between p-2 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23]">
              <span>Easy</span>
              <strong>{user.bestTimeEasy ? formatDuration(user.bestTimeEasy) : '—'}</strong>
            </div>
            <div className="flex justify-between p-2 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23]">
              <span>Medium</span>
              <strong>{user.bestTimeMedium ? formatDuration(user.bestTimeMedium) : '—'}</strong>
            </div>
            <div className="flex justify-between p-2 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23]">
              <span>Hard</span>
              <strong>{user.bestTimeHard ? formatDuration(user.bestTimeHard) : '—'}</strong>
            </div>
            <div className="flex justify-between p-2 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23]">
              <span>Expert</span>
              <strong>{user.bestTimeExpert ? formatDuration(user.bestTimeExpert) : '—'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Achievement Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ACHIEVEMENTS.map((ach) => {
          const unlockedAt = unlockedMap.get(ach.id);
          const isUnlocked = Boolean(unlockedAt);

          return (
            <div
              key={ach.id}
              className={`p-5 rounded-3xl border transition-colors ${
                isUnlocked
                  ? 'bg-[#FCF8F2] dark:bg-[#29201B] border-[#B98B68]/50 dark:border-[#C99A75]/50 shadow-sm'
                  : 'bg-[#F7F0E5]/70 dark:bg-[#241C17] border-[#E8D5BC] dark:border-[#352A23] opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    isUnlocked
                      ? 'bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713]'
                      : 'bg-[#E8D5BC] dark:bg-[#352A23] text-[#76533D] dark:text-[#D2C2B0]'
                  }`}
                >
                  <AchievementIcon iconKey={ach.iconKey} />
                </div>
                <span className="font-mono-tabular text-xs font-bold text-[#76533D] dark:text-[#C99A75]">
                  +{ach.xpReward} XP
                </span>
              </div>

              <h3 className="font-display font-bold text-base text-[#49382D] dark:text-[#F5EBDD] mt-4 flex items-center gap-1.5">
                <span>{ach.title}</span>
                {isUnlocked ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-[#76533D]/60 shrink-0" />
                )}
              </h3>
              <p className="text-xs text-[#76533D] dark:text-[#D2C2B0] mt-1 leading-relaxed">{ach.description}</p>
              <p className="text-[11px] text-[#76533D]/70 dark:text-[#D2C2B0]/70 mt-3 font-mono-tabular">
                {isUnlocked ? `Unlocked ${unlockedAt!.slice(0, 10)}` : 'Locked'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
