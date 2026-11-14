import React, { useState } from 'react';
import { Award, Home, Play, Settings, Users, Volume2, VolumeX, X } from 'lucide-react';
import { Difficulty, SavedGame } from './shared/types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { playMenuTransitionSound, playToggleSound, unlockAudio } from './utils/sound';
import { BrandMark, CapyAvatarImg } from './components/BrandMark';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { SoloGameView } from './components/SoloGameView';
import { MultiplayerView } from './components/MultiplayerView';
import { FriendsAndLeaderboardView } from './components/FriendsAndLeaderboardView';
import { AchievementsView } from './components/AchievementsView';
import { SettingsView } from './components/SettingsView';

type AppView =
  | 'dashboard'
  | 'solo'
  | 'daily'
  | 'multiplayer'
  | 'friends'
  | 'leaderboard'
  | 'achievements'
  | 'settings';

function PlaycotedokuShell() {
  const { user, loading, pendingInvites, dismissInvite, sendWs, updatePreferences } = useAuth();
  const [view, setView] = useState<AppView>('dashboard');
  const [soloDiff, setSoloDiff] = useState<Difficulty>('medium');
  const [resumedGame, setResumedGame] = useState<SavedGame | null>(null);

  const navigateTo = (nextView: AppView) => {
    if (nextView !== view) {
      playMenuTransitionSound();
    }
    setView(nextView);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F0E5] dark:bg-[#1E1713] flex flex-col items-center justify-center gap-4 p-6">
        <BrandMark size="lg" />
        <p className="text-sm text-[#76533D] dark:text-[#C99A75] font-medium">Warming up the espresso machine...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const handleStartSolo = (diff: Difficulty) => {
    unlockAudio();
    playMenuTransitionSound();
    setResumedGame(null);
    setSoloDiff(diff);
    setView('solo');
  };

  const handleResumeGame = (game: SavedGame) => {
    unlockAudio();
    playMenuTransitionSound();
    setResumedGame(game);
    setView(game.mode === 'daily' ? 'daily' : 'solo');
  };

  const handleAcceptInvite = (roomCode: string) => {
    unlockAudio();
    playMenuTransitionSound();
    dismissInvite(roomCode);
    sendWs({ type: 'room:join', code: roomCode });
    setView('multiplayer');
  };

  const handleToggleSound = () => {
    unlockAudio();
    const next = !user.soundEnabled;
    if (next) {
      playToggleSound(true);
    }
    updatePreferences({ soundEnabled: next }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-[#F7F0E5] dark:bg-[#1E1713] text-[#49382D] dark:text-[#EDE2D3] flex flex-col pb-20 md:pb-0">
      {/* Clean 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#F7F0E5]/95 dark:bg-[#1E1713]/95 backdrop-blur-md border-b border-[#E8D5BC] dark:border-[#352A23]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 md:gap-8">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => navigateTo('dashboard')}
            className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#76533D] rounded-xl"
          >
            <BrandMark size="sm" />
          </button>

          {/* Zone 2: 5 Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'multiplayer', label: 'Multiplayer' },
              { id: 'friends', label: 'Friends' },
              { id: 'leaderboard', label: 'Leaderboard' },
              { id: 'achievements', label: 'Badges' },
            ].map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id as AppView)}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                    active
                      ? 'border-[#76533D] dark:border-[#C99A75] text-[#49382D] dark:text-[#F5EBDD]'
                      : 'border-transparent text-[#76533D] dark:text-[#D2C2B0] hover:text-[#49382D] dark:hover:text-[#F5EBDD]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Quick Sound Toggle + Profile/Settings Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleSound}
              aria-label={user.soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              aria-pressed={user.soundEnabled}
              title={user.soundEnabled ? 'Sound Effects: ON' : 'Sound Effects: OFF'}
              className="p-2 rounded-xl bg-[#E8D5BC]/70 dark:bg-[#29201B] hover:bg-[#E8D5BC] dark:hover:bg-[#352A23] text-[#76533D] dark:text-[#C99A75] transition-colors cursor-pointer touch-manipulation"
            >
              {user.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 opacity-70" />}
            </button>
            <button
              type="button"
              onClick={() => navigateTo('settings')}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#E8D5BC]/70 dark:bg-[#29201B] hover:bg-[#E8D5BC] dark:hover:bg-[#352A23] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <CapyAvatarImg avatarId={user.avatarId} sizeClass="w-7 h-7" />
              <span className="text-xs font-bold text-[#49382D] dark:text-[#F5EBDD] max-w-[110px] truncate">
                {user.username}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Incoming Live Multiplayer Invites */}
      {user.notificationsEnabled && pendingInvites.length > 0 && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4 space-y-2">
          {pendingInvites.map((inv) => (
            <div
              key={inv.roomCode}
              className="p-3.5 rounded-2xl bg-[#E8D5BC] dark:bg-[#352A23] border border-[#B98B68] flex flex-wrap items-center justify-between gap-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <CapyAvatarImg avatarId={inv.fromAvatarId} sizeClass="w-9 h-9" />
                <div className="text-sm">
                  <strong className="text-[#49382D] dark:text-[#F5EBDD]">{inv.fromUsername}</strong> invited you to{' '}
                  <strong>{inv.roomName}</strong> ({inv.mode === 'coop' ? 'Co-op' : '1v1 Race'} · {inv.difficulty})
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAcceptInvite(inv.roomCode)}
                  className="px-4 py-1.5 rounded-xl bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713] text-xs font-semibold cursor-pointer"
                >
                  Join Table
                </button>
                <button
                  type="button"
                  onClick={() => dismissInvite(inv.roomCode)}
                  aria-label="Dismiss invite"
                  className="p-1.5 rounded-lg text-[#76533D] dark:text-[#D2C2B0] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {view === 'dashboard' && (
          <DashboardView
            onStartSolo={handleStartSolo}
            onResumeGame={handleResumeGame}
            onOpenDaily={() => {
              playMenuTransitionSound();
              setResumedGame(null);
              setView('daily');
            }}
            onNavigate={(tab) => navigateTo(tab)}
          />
        )}
        {view === 'solo' && (
          <SoloGameView
            mode="solo"
            initialSavedGame={resumedGame}
            initialDifficulty={soloDiff}
            onExit={() => {
              setResumedGame(null);
              navigateTo('dashboard');
            }}
          />
        )}
        {view === 'daily' && (
          <SoloGameView
            mode="daily"
            initialSavedGame={resumedGame}
            onExit={() => {
              setResumedGame(null);
              navigateTo('dashboard');
            }}
          />
        )}
        {view === 'multiplayer' && <MultiplayerView />}
        {view === 'friends' && (
          <FriendsAndLeaderboardView
            initialTab="friends"
            onGoToMultiplayer={() => navigateTo('multiplayer')}
          />
        )}
        {view === 'leaderboard' && (
          <FriendsAndLeaderboardView
            initialTab="leaderboard"
            onGoToMultiplayer={() => navigateTo('multiplayer')}
          />
        )}
        {view === 'achievements' && <AchievementsView />}
        {view === 'settings' && <SettingsView />}
      </main>

      {/* Mobile Bottom Thumb Navigation Bar (<= 15% mobile height) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#FCF8F2]/95 dark:bg-[#241C17]/95 backdrop-blur-md border-t border-[#E8D5BC] dark:border-[#352A23] grid grid-cols-5 items-center"
      >
        {[
          { id: 'dashboard', label: 'Home', icon: <Home className="w-5 h-5" /> },
          { id: 'solo', label: 'Play', icon: <Play className="w-5 h-5" /> },
          { id: 'multiplayer', label: 'Rooms', icon: <Users className="w-5 h-5" /> },
          { id: 'friends', label: 'Social', icon: <Award className="w-5 h-5" /> },
          { id: 'settings', label: 'Profile', icon: <Settings className="w-5 h-5" /> },
        ].map((item) => {
          const active =
            view === item.id ||
            (item.id === 'friends' && (view === 'leaderboard' || view === 'achievements')) ||
            (item.id === 'solo' && view === 'daily');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'solo') handleStartSolo('medium');
                else navigateTo(item.id as AppView);
              }}
              className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
                active ? 'text-[#76533D] dark:text-[#C99A75] font-bold' : 'text-[#76533D]/70 dark:text-[#D2C2B0]/70'
              }`}
            >
              {item.icon}
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PlaycotedokuShell />
    </AuthProvider>
  );
}
