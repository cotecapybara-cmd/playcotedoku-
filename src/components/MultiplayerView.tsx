import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Coffee,
  Copy,
  Crown,
  DoorOpen,
  Lightbulb,
  MessageCircle,
  Pencil,
  Play,
  RefreshCw,
  Send,
  Swords,
  UserPlus,
  Users,
} from 'lucide-react';
import { Difficulty, PublicPlayer } from '../shared/types';
import { DIFFICULTY_CONFIG } from '../shared/sudoku';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { playPuzzleStartSound, playVictorySound, unlockAudio } from '../utils/sound';
import { CapyAvatarImg, formatDuration } from './BrandMark';
import { SudokuBoard } from './SudokuBoard';

const COFFEE_TABLE_NAMES = [
  'Latte Room',
  'Mocha Match',
  'Cozy Corner',
  'Cappuccino Club',
  'Espresso Lounge',
  'Caramel Table',
];

export function MultiplayerView() {
  const { user, activeRoom, lobbyRooms, sendWs, wsConnected, wsError, clearWsError, friendSignal, refreshUser } =
    useAuth();

  const [createMode, setCreateMode] = useState<'coop' | 'race'>('coop');
  const [createDifficulty, setCreateDifficulty] = useState<Difficulty>('medium');
  const [createName, setCreateName] = useState(COFFEE_TABLE_NAMES[0]);
  const [joinCode, setJoinCode] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [friends, setFriends] = useState<PublicPlayer[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [invitedIds, setInvitedIds] = useState<number[]>([]);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [introPlaying, setIntroPlaying] = useState(false);
  const startedMatchesRef = useRef<Set<string>>(new Set());

  // Load friends for invites
  useEffect(() => {
    apiRequest<{ friends: PublicPlayer[] }>('/api/friends')
      .then((res) => setFriends(res.friends || []))
      .catch(() => {});
  }, [friendSignal]);

  // Play cute puzzle opening sound once when a multiplayer match enters 'playing'
  useEffect(() => {
    if (!activeRoom || activeRoom.status !== 'playing') {
      setIntroPlaying(false);
      return;
    }
    const matchKey = `${activeRoom.code}-${activeRoom.startedAt || 0}`;
    if (startedMatchesRef.current.has(matchKey)) return;
    startedMatchesRef.current.add(matchKey);

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
  }, [activeRoom?.code, activeRoom?.status, activeRoom?.startedAt]);

  // Refresh user stats when match finishes
  useEffect(() => {
    if (activeRoom?.status === 'finished') {
      playVictorySound();
      refreshUser();
    }
  }, [activeRoom?.status, refreshUser]);

  // Live timer synced to room.startedAt
  useEffect(() => {
    if (!activeRoom || activeRoom.status !== 'playing' || !activeRoom.startedAt) {
      if (activeRoom?.startedAt && activeRoom?.finishedAt) {
        setLiveSeconds(Math.max(1, Math.round((activeRoom.finishedAt - activeRoom.startedAt) / 1000)));
      } else {
        setLiveSeconds(0);
      }
      return;
    }
    const update = () => {
      setLiveSeconds(Math.max(0, Math.floor((Date.now() - activeRoom.startedAt!) / 1000)));
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [activeRoom?.status, activeRoom?.startedAt, activeRoom?.finishedAt]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    clearWsError();
    sendWs({
      type: 'room:create',
      mode: createMode,
      difficulty: createDifficulty,
      name: createName,
    });
  };

  const handleJoinCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    clearWsError();
    sendWs({ type: 'room:join', code: joinCode.trim().toUpperCase() });
  };

  const handleCopyCode = () => {
    if (!activeRoom) return;
    navigator.clipboard?.writeText(activeRoom.code).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendWs({ type: 'room:chat', text: chatInput.trim() });
    setChatInput('');
  };

  const handleInviteFriend = (friendId: number) => {
    if (!activeRoom) return;
    sendWs({ type: 'invite:send', targetUserId: friendId, roomCode: activeRoom.code });
    setInvitedIds((prev) => [...prev, friendId]);
    setTimeout(() => {
      setInvitedIds((prev) => prev.filter((id) => id !== friendId));
    }, 3000);
  };

  // --- ACTIVE ROOM VIEW ---
  if (activeRoom) {
    const isHost = activeRoom.hostId === user?.id;
    const activeBoard = activeRoom.mode === 'coop' ? activeRoom.coopBoard : activeRoom.myRaceBoard;
    const activeNotes = activeRoom.mode === 'coop' ? activeRoom.coopNotes : activeRoom.myRaceNotes;
    const activeMistakes =
      activeRoom.mode === 'coop' ? activeRoom.coopMistakes || 0 : activeRoom.myRaceMistakes || 0;
    const activeScore = activeRoom.mode === 'coop' ? activeRoom.coopScore || 0 : activeRoom.myRaceScore || 0;

    return (
      <div className="space-y-5 pb-8">
        {/* Room Header Bar */}
        <div className="p-4 sm:p-5 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#E8D5BC] dark:bg-[#352A23] text-[#76533D] dark:text-[#C99A75] flex items-center justify-center">
              {activeRoom.mode === 'coop' ? <Users className="w-5 h-5" /> : <Swords className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-xl font-bold text-[#49382D] dark:text-[#F5EBDD]">
                  {activeRoom.name}
                </h2>
                <span className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">
                  · {activeRoom.mode === 'coop' ? 'Co-op Shared Board' : '1v1 Race'} ·{' '}
                  {DIFFICULTY_CONFIG[activeRoom.difficulty].label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-[#76533D] dark:text-[#D2C2B0]">
                <span>Room Code:</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#E8D5BC]/70 dark:bg-[#352A23] font-mono-tabular font-bold text-[#49382D] dark:text-[#F5EBDD] cursor-pointer"
                >
                  <span>{activeRoom.code}</span>
                  {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {activeRoom.status === 'waiting' && isHost && (
              <button
                type="button"
                onClick={() => {
                  unlockAudio();
                  sendWs({ type: 'room:start' });
                }}
                className="px-4 py-2.5 rounded-xl bg-[#76533D] hover:bg-[#5E412F] dark:bg-[#C99A75] dark:hover:bg-[#B98B68] text-[#F7F0E5] dark:text-[#1E1713] font-semibold text-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Start Match</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => sendWs({ type: 'room:leave' })}
              className="px-3.5 py-2.5 rounded-xl bg-[#E8D5BC]/80 dark:bg-[#352A23] hover:bg-red-100 dark:hover:bg-red-950/50 text-[#49382D] dark:text-[#F5EBDD] hover:text-red-700 font-semibold text-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <DoorOpen className="w-4 h-4" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {wsError && (
          <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200 flex items-center justify-between">
            <span>{wsError}</span>
            <button type="button" onClick={clearWsError} className="text-xs font-bold underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* Participants Live Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {activeRoom.participants.map((p) => (
            <div
              key={p.userId}
              className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                activeRoom.winnerId === p.userId
                  ? 'bg-[#E8D5BC] dark:bg-[#3A2E26] border-[#76533D] dark:border-[#C99A75]'
                  : 'bg-[#FCF8F2] dark:bg-[#29201B] border-[#E8D5BC] dark:border-[#3D3028]'
              }`}
            >
              <CapyAvatarImg avatarId={p.avatarId} sizeClass="w-11 h-11" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-display font-bold text-sm text-[#49382D] dark:text-[#F5EBDD] truncate">
                    {p.username}
                  </p>
                  {p.isHost && <Crown className="w-3.5 h-3.5 text-[#B98B68] shrink-0" />}
                </div>
                <div className="flex items-center justify-between text-xs text-[#76533D] dark:text-[#D2C2B0] mt-0.5 font-mono-tabular">
                  <span>{p.isConnected ? 'Ready' : 'Reconnecting'}</span>
                  <span>{p.progress}%</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-[#E8D5BC] dark:bg-[#352A23] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#76533D] dark:bg-[#C99A75] transition-all duration-200"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Waiting Room or Active Board + Chat */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8">
            {activeRoom.status === 'waiting' ? (
              <div className="p-6 sm:p-8 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] text-center space-y-5">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E8D5BC] dark:bg-[#352A23] text-[#76533D] dark:text-[#C99A75] flex items-center justify-center">
                  <Coffee className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-[#49382D] dark:text-[#F5EBDD]">
                    Waiting at {activeRoom.name}
                  </h3>
                  <p className="text-sm text-[#76533D] dark:text-[#D2C2B0] mt-1 max-w-md mx-auto">
                    Share room code <strong className="font-mono-tabular">{activeRoom.code}</strong> or invite an online friend below.{' '}
                    {isHost ? 'Click "Start Match" whenever everyone is seated.' : 'Waiting for the host to start the match.'}
                  </p>
                </div>

                {/* Quick Invite Friends inside Waiting Room */}
                {friends.length > 0 && (
                  <div className="max-w-lg mx-auto pt-3 border-t border-[#E8D5BC] dark:border-[#3D3028] text-left">
                    <p className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75] mb-2.5">
                      Invite Friends to This Table
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {friends.map((f) => {
                        const alreadyHere = activeRoom.participants.some((p) => p.userId === f.id);
                        const sent = invitedIds.includes(f.id);
                        return (
                          <div
                            key={f.id}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <CapyAvatarImg avatarId={f.avatarId} sizeClass="w-8 h-8" />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#49382D] dark:text-[#F5EBDD] truncate">
                                  {f.username}
                                </p>
                                <p className="text-[11px] text-[#76533D] dark:text-[#D2C2B0]">
                                  {f.isOnline ? 'Online' : 'Offline'}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={alreadyHere || !f.isOnline || sent}
                              onClick={() => handleInviteFriend(f.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713] text-xs font-semibold disabled:opacity-40 cursor-pointer shrink-0"
                            >
                              {alreadyHere ? 'Seated' : sent ? 'Sent!' : 'Invite'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              activeBoard &&
              activeNotes && (
                <SudokuBoard
                  mode={activeRoom.mode}
                  difficulty={activeRoom.difficulty}
                  puzzle={activeRoom.puzzle}
                  board={activeBoard}
                  notes={activeNotes}
                  mistakeCells={
                    activeRoom.mode === 'coop' ? activeRoom.coopMistakeCells : activeRoom.myRaceMistakeCells
                  }
                  elapsedSeconds={liveSeconds}
                  mistakes={activeMistakes}
                  hintsUsed={activeRoom.myHintsUsed}
                  score={activeScore}
                  fastPencilDefault={user?.fastPencilDefault}
                  readOnly={activeRoom.status === 'finished' || introPlaying}
                  coopActors={activeRoom.coopActors}
                  puzzleKey={`${activeRoom.code}-${activeRoom.matchId}`}
                  multiplayerMatchHintsLeft={activeRoom.myHintsRemaining}
                  accountHintCredits={activeRoom.myAccountHintCredits}
                  accountPencilCredits={activeRoom.myAccountPencilCredits}
                  fastPencilUnlocked={activeRoom.myFastPencilUnlocked}
                  onMultiplayerMove={(row, col, value, isPencil) => {
                    sendWs({ type: 'room:move', row, col, value, isPencil });
                  }}
                  onMultiplayerHint={(row, col) => {
                    sendWs({ type: 'room:hint', row, col });
                  }}
                  onMultiplayerUnlockFastPencil={() => {
                    sendWs({ type: 'room:use-pencil-credit' });
                  }}
                />
              )
            )}
          </div>

          {/* Live Room Chat + Match Results */}
          <div className="xl:col-span-4 space-y-4">
            {activeRoom.status === 'finished' && (
              <div className="p-5 rounded-3xl bg-[#E8D5BC] dark:bg-[#3A2E26] border border-[#76533D] dark:border-[#C99A75] space-y-3">
                <div className="flex items-center gap-2 text-[#49382D] dark:text-[#F5EBDD]">
                  <Crown className="w-5 h-5 text-[#76533D] dark:text-[#C99A75]" />
                  <h3 className="font-display text-lg font-bold">
                    {activeRoom.mode === 'coop'
                      ? 'Co-op Puzzle Solved!'
                      : activeRoom.winnerId === user?.id
                      ? 'You Won the 1v1 Race!'
                      : `${activeRoom.winnerUsername} Won the Race!`}
                  </h3>
                </div>
                <p className="text-xs text-[#49382D]/85 dark:text-[#D2C2B0] font-mono-tabular">
                  Match time: {formatDuration(liveSeconds)}
                </p>

                {activeRoom.myMatchReward && (
                  <div
                    data-match-rewards="true"
                    className="p-3 rounded-2xl bg-[#FCF8F2]/85 dark:bg-[#29201B]/90 border border-[#B98B68]/35 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-display font-bold text-[#49382D] dark:text-[#F5EBDD]">
                        Rewards Earned
                      </span>
                      <span className="font-mono-tabular font-bold text-[#76533D] dark:text-[#C99A75]">
                        +{activeRoom.myMatchReward.xpEarned} XP
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] flex items-center gap-2">
                        <Lightbulb className="w-3.5 h-3.5 text-[#B98B68] shrink-0" />
                        <span className="font-mono-tabular font-semibold text-[#49382D] dark:text-[#F5EBDD]">
                          +{activeRoom.myMatchReward.hintCredits} Hint{activeRoom.myMatchReward.hintCredits === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] flex items-center gap-2">
                        <Pencil className="w-3.5 h-3.5 text-[#76533D] dark:text-[#C99A75] shrink-0" />
                        <span className="font-mono-tabular font-semibold text-[#49382D] dark:text-[#F5EBDD]">
                          +{activeRoom.myMatchReward.pencilCredits} Pencil{activeRoom.myMatchReward.pencilCredits === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#76533D] dark:text-[#D2C2B0] font-mono-tabular">
                      Saved balance: {activeRoom.myAccountHintCredits} Hint · {activeRoom.myAccountPencilCredits} Pencil credits
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => sendWs({ type: 'room:rematch' })}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#76533D] hover:bg-[#5E412F] dark:bg-[#C99A75] dark:hover:bg-[#B98B68] text-[#F7F0E5] dark:text-[#1E1713] font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>
                    {activeRoom.participants.find((p) => p.userId === user?.id)?.rematchReady
                      ? 'Waiting for Rematch...'
                      : 'Request Rematch'}
                  </span>
                </button>
              </div>
            )}

            {/* Live Chat Box */}
            <div className="rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm flex flex-col h-[380px]">
              <div className="px-4 py-3 border-b border-[#E8D5BC] dark:border-[#3D3028] flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#76533D] dark:text-[#C99A75]" />
                <h3 className="font-display font-bold text-sm text-[#49382D] dark:text-[#F5EBDD]">Table Chat</h3>
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                {activeRoom.chat.map((msg) =>
                  msg.isSystem ? (
                    <p key={msg.id} className="text-xs text-center text-[#76533D] dark:text-[#C99A75] py-1">
                      {msg.text}
                    </p>
                  ) : (
                    <div key={msg.id} className="flex items-start gap-2.5">
                      <CapyAvatarImg avatarId={msg.avatarId} sizeClass="w-7 h-7" />
                      <div className="min-w-0 flex-1 bg-[#F7F0E5] dark:bg-[#352A23] px-3 py-2 rounded-2xl">
                        <p className="text-[11px] font-bold text-[#76533D] dark:text-[#C99A75]">{msg.username}</p>
                        <p className="text-xs text-[#49382D] dark:text-[#F5EBDD] break-words">{msg.text}</p>
                      </div>
                    </div>
                  )
                )}
              </div>

              <form onSubmit={handleSendChat} className="p-3 border-t border-[#E8D5BC] dark:border-[#3D3028] flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Say hello at the table..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] border border-[#E8D5BC] dark:border-[#49382D] text-xs text-[#49382D] dark:text-[#F5EBDD] focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  className="p-2.5 rounded-xl bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713] cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- MULTIPLAYER LOBBY VIEW ---
  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#49382D] dark:text-[#F5EBDD]">
            Coffee Shop Multiplayer Lobby
          </h1>
          <p className="text-sm text-[#76533D] dark:text-[#D2C2B0] mt-1">
            Open a table to solve together in Co-op or race 1v1 in real time.
          </p>
        </div>
        <span className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">
          {wsConnected ? 'Live Sync Ready' : 'Connecting...'}
        </span>
      </div>

      {wsError && (
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200 flex items-center justify-between">
          <span>{wsError}</span>
          <button type="button" onClick={clearWsError} className="text-xs font-bold underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Create Room Card */}
        <form
          onSubmit={handleCreateRoom}
          className="lg:col-span-5 p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-4"
        >
          <h2 className="font-display text-xl font-bold text-[#49382D] dark:text-[#F5EBDD]">Create a Table</h2>

          <div>
            <label className="block text-xs font-semibold text-[#76533D] dark:text-[#C99A75] mb-1.5">Game Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreateMode('coop')}
                className={`p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                  createMode === 'coop'
                    ? 'bg-[#E8D5BC] dark:bg-[#3A2E26] border-[#76533D] dark:border-[#C99A75]'
                    : 'bg-[#F7F0E5] dark:bg-[#352A23] border-transparent'
                }`}
              >
                <Users className="w-4 h-4 text-[#76533D] dark:text-[#C99A75] mb-1" />
                <p className="font-display font-bold text-sm text-[#49382D] dark:text-[#F5EBDD]">Co-op</p>
                <p className="text-[11px] text-[#76533D] dark:text-[#D2C2B0]">Solve the same board together</p>
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('race')}
                className={`p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
                  createMode === 'race'
                    ? 'bg-[#E8D5BC] dark:bg-[#3A2E26] border-[#76533D] dark:border-[#C99A75]'
                    : 'bg-[#F7F0E5] dark:bg-[#352A23] border-transparent'
                }`}
              >
                <Swords className="w-4 h-4 text-[#76533D] dark:text-[#C99A75] mb-1" />
                <p className="font-display font-bold text-sm text-[#49382D] dark:text-[#F5EBDD]">1v1 Race</p>
                <p className="text-[11px] text-[#76533D] dark:text-[#D2C2B0]">First to finish wins</p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#76533D] dark:text-[#C99A75] mb-1.5">Table Name</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COFFEE_TABLE_NAMES.slice(0, 4).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCreateName(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                    createName === preset
                      ? 'bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713]'
                      : 'bg-[#E8D5BC]/60 dark:bg-[#352A23] text-[#49382D] dark:text-[#D2C2B0]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              maxLength={32}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] border border-[#E8D5BC] dark:border-[#49382D] text-sm text-[#49382D] dark:text-[#F5EBDD] focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#76533D] dark:text-[#C99A75] mb-1.5">Difficulty</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setCreateDifficulty(diff)}
                  className={`py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                    createDifficulty === diff
                      ? 'bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713]'
                      : 'bg-[#F7F0E5] dark:bg-[#352A23] text-[#49382D] dark:text-[#D2C2B0]'
                  }`}
                >
                  {DIFFICULTY_CONFIG[diff].label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#76533D] hover:bg-[#5E412F] dark:bg-[#C99A75] dark:hover:bg-[#B98B68] text-[#F7F0E5] dark:text-[#1E1713] font-semibold text-sm cursor-pointer transition-colors"
          >
            Open Table & Get Room Code
          </button>
        </form>

        {/* Right: Join by Code + Open Rooms + Online Friends */}
        <div className="lg:col-span-7 space-y-5">
          {/* Join by Code */}
          <form
            onSubmit={handleJoinCode}
            className="p-5 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
          >
            <div className="flex-1">
              <label className="block text-xs font-semibold text-[#76533D] dark:text-[#C99A75] mb-1.5">
                Join with Room Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-character code (e.g. LATTE7)"
                maxLength={8}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] border border-[#E8D5BC] dark:border-[#49382D] font-mono-tabular uppercase text-sm text-[#49382D] dark:text-[#F5EBDD] focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#76533D] hover:bg-[#5E412F] dark:bg-[#C99A75] dark:hover:bg-[#B98B68] text-[#F7F0E5] dark:text-[#1E1713] font-semibold text-sm cursor-pointer whitespace-nowrap"
            >
              Join Table
            </button>
          </form>

          {/* Open Tables */}
          <div className="p-5 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#49382D] dark:text-[#F5EBDD]">Open Tables</h3>
              <button
                type="button"
                onClick={() => sendWs({ type: 'room:list' })}
                className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75] hover:underline cursor-pointer"
              >
                Refresh
              </button>
            </div>
            {lobbyRooms.length === 0 ? (
              <p className="text-sm text-[#76533D] dark:text-[#D2C2B0] py-4 text-center">
                No waiting tables open right now. Create one on the left and invite your friends!
              </p>
            ) : (
              <div className="space-y-2.5">
                {lobbyRooms.map((rm) => (
                  <div
                    key={rm.code}
                    className="p-3.5 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CapyAvatarImg avatarId={rm.hostAvatarId} sizeClass="w-10 h-10" />
                      <div className="min-w-0">
                        <p className="font-display font-bold text-sm text-[#49382D] dark:text-[#F5EBDD] truncate">
                          {rm.name}
                        </p>
                        <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">
                          {rm.mode === 'coop' ? 'Co-op' : '1v1 Race'} · {rm.difficulty} · {rm.playerCount} seated ·{' '}
                          <span className="font-mono-tabular">{rm.code}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => sendWs({ type: 'room:join', code: rm.code })}
                      className="px-4 py-2 rounded-xl bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713] text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Online Friends Snapshot */}
          <div className="p-5 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-3">
            <h3 className="font-display text-lg font-bold text-[#49382D] dark:text-[#F5EBDD] flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#B98B68]" />
              <span>Online Friends</span>
            </h3>
            {friends.filter((f) => f.isOnline).length === 0 ? (
              <p className="text-sm text-[#76533D] dark:text-[#D2C2B0]">
                None of your friends are online right now. Add friends from the Friends tab!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {friends
                  .filter((f) => f.isOnline)
                  .map((f) => (
                    <div key={f.id} className="p-3 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23] flex items-center gap-3">
                      <CapyAvatarImg avatarId={f.avatarId} sizeClass="w-9 h-9" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[#49382D] dark:text-[#F5EBDD] truncate">{f.username}</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">Online · Lv {f.level}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
