import React, { useCallback, useEffect, useState } from 'react';
import { Award, Check, Search, Trophy, UserCheck, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { PublicPlayer, UnlockedAchievement } from '../shared/types';
import { ACHIEVEMENTS } from '../shared/achievements';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { CapyAvatarImg, formatDuration } from './BrandMark';

interface FriendsAndLeaderboardViewProps {
  initialTab?: 'friends' | 'leaderboard';
  onGoToMultiplayer: () => void;
}

export function FriendsAndLeaderboardView({
  initialTab = 'friends',
  onGoToMultiplayer,
}: FriendsAndLeaderboardViewProps) {
  const { user, friendSignal, activeRoom, sendWs } = useAuth();
  const [section, setSection] = useState<'friends' | 'leaderboard'>(initialTab);

  // Friends state
  const [friends, setFriends] = useState<PublicPlayer[]>([]);
  const [incoming, setIncoming] = useState<PublicPlayer[]>([]);
  const [outgoing, setOutgoing] = useState<PublicPlayer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicPlayer[]>([]);
  const [searching, setSearching] = useState(false);

  // Leaderboards state
  const [lbTab, setLbTab] = useState<'global' | 'friends'>('global');
  const [globalLb, setGlobalLb] = useState<Array<PublicPlayer & { rank: number }>>([]);
  const [friendsLb, setFriendsLb] = useState<Array<PublicPlayer & { rank: number }>>([]);

  // Inspected player modal
  const [viewedProfile, setViewedProfile] = useState<{
    player: PublicPlayer;
    achievements: UnlockedAchievement[];
  } | null>(null);

  useEffect(() => {
    setSection(initialTab);
  }, [initialTab]);

  const loadFriends = useCallback(() => {
    apiRequest<{ friends: PublicPlayer[]; incoming: PublicPlayer[]; outgoing: PublicPlayer[] }>('/api/friends')
      .then((res) => {
        setFriends(res.friends || []);
        setIncoming(res.incoming || []);
        setOutgoing(res.outgoing || []);
      })
      .catch(() => {});
  }, []);

  const loadLeaderboards = useCallback(() => {
    apiRequest<{
      global: Array<PublicPlayer & { rank: number }>;
      friends: Array<PublicPlayer & { rank: number }>;
    }>('/api/leaderboards')
      .then((res) => {
        setGlobalLb(res.global || []);
        setFriendsLb(res.friends || []);
      })
      .catch(() => {});
  }, []);

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await apiRequest<{ users: PublicPlayer[] }>(`/api/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.users || []);
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
    loadLeaderboards();
    runSearch(searchQuery);
  }, [friendSignal, loadFriends, loadLeaderboards, runSearch, searchQuery]);

  const handleSendRequest = async (targetUserId: number) => {
    await apiRequest('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }).catch(() => {});
    loadFriends();
    runSearch(searchQuery);
  };

  const handleRespond = async (targetUserId: number, accept: boolean) => {
    await apiRequest('/api/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, accept }),
    }).catch(() => {});
    loadFriends();
    loadLeaderboards();
    runSearch(searchQuery);
  };

  const handleRemoveFriend = async (friendId: number) => {
    await apiRequest(`/api/friends/${friendId}`, { method: 'DELETE' }).catch(() => {});
    loadFriends();
    loadLeaderboards();
    runSearch(searchQuery);
  };

  const handleViewProfile = async (playerId: number) => {
    try {
      const res = await apiRequest<{ player: PublicPlayer; achievements: UnlockedAchievement[] }>(
        `/api/users/${playerId}/profile`
      );
      setViewedProfile(res);
    } catch {
      // ignore
    }
  };

  const handleInvitePlayer = (playerId: number) => {
    if (activeRoom) {
      sendWs({ type: 'invite:send', targetUserId: playerId, roomCode: activeRoom.code });
    } else {
      onGoToMultiplayer();
    }
  };

  const lbRows = lbTab === 'global' ? globalLb : friendsLb;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#49382D] dark:text-[#F5EBDD]">
            {section === 'friends' ? 'Friends & Community' : 'Leaderboards'}
          </h1>
          <p className="text-sm text-[#76533D] dark:text-[#D2C2B0] mt-1">
            {section === 'friends'
              ? 'Find players, accept friend requests, check online status, and inspect stats.'
              : 'Compare XP, wins, and rankings globally or among your friends.'}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#E8D5BC]/70 dark:bg-[#29201B]">
          <button
            type="button"
            onClick={() => setSection('friends')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              section === 'friends'
                ? 'bg-[#FCF8F2] dark:bg-[#352A23] text-[#49382D] dark:text-[#F5EBDD] shadow-sm'
                : 'text-[#76533D] dark:text-[#D2C2B0]'
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            type="button"
            onClick={() => setSection('leaderboard')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              section === 'leaderboard'
                ? 'bg-[#FCF8F2] dark:bg-[#352A23] text-[#49382D] dark:text-[#F5EBDD] shadow-sm'
                : 'text-[#76533D] dark:text-[#D2C2B0]'
            }`}
          >
            Leaderboards
          </button>
        </div>
      </div>

      {section === 'friends' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Friends List & Pending Requests */}
          <div className="lg:col-span-7 space-y-5">
            {incoming.length > 0 && (
              <div className="p-5 rounded-3xl bg-[#E8D5BC]/60 dark:bg-[#352A23] border border-[#B98B68]/35 space-y-3">
                <h2 className="font-display font-bold text-base text-[#49382D] dark:text-[#F5EBDD]">
                  Friend Requests ({incoming.length})
                </h2>
                <div className="space-y-2.5">
                  {incoming.map((reqPlayer) => (
                    <div
                      key={reqPlayer.id}
                      className="p-3 rounded-2xl bg-[#FCF8F2] dark:bg-[#29201B] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CapyAvatarImg avatarId={reqPlayer.avatarId} sizeClass="w-10 h-10" />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-[#49382D] dark:text-[#F5EBDD] truncate">
                            {reqPlayer.username}
                          </p>
                          <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">
                            Lv {reqPlayer.level} · {reqPlayer.wins} wins
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRespond(reqPlayer.id, true)}
                          className="px-3 py-1.5 rounded-xl bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespond(reqPlayer.id, false)}
                          className="px-3 py-1.5 rounded-xl bg-[#E8D5BC] dark:bg-[#352A23] text-[#49382D] dark:text-[#F5EBDD] text-xs font-semibold cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-4">
              <h2 className="font-display text-lg font-bold text-[#49382D] dark:text-[#F5EBDD] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#B98B68]" />
                <span>Your Friends</span>
              </h2>
              {friends.length === 0 ? (
                <p className="text-sm text-[#76533D] dark:text-[#D2C2B0] py-4">
                  No friends added yet. Search by username on the right to connect with other players!
                </p>
              ) : (
                <div className="space-y-2.5">
                  {friends.map((f) => (
                    <div
                      key={f.id}
                      className="p-3.5 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23] flex flex-wrap items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => handleViewProfile(f.id)}
                        className="flex items-center gap-3 min-w-0 text-left cursor-pointer group"
                      >
                        <CapyAvatarImg avatarId={f.avatarId} sizeClass="w-11 h-11" />
                        <div className="min-w-0">
                          <p className="font-display font-bold text-sm text-[#49382D] dark:text-[#F5EBDD] group-hover:underline truncate">
                            {f.username}
                          </p>
                          <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">
                            <span className={f.isOnline ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : ''}>
                              {f.isOnline ? 'Online' : 'Offline'}
                            </span>
                            {' · '}Lv {f.level} · {f.wins} wins
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleViewProfile(f.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#E8D5BC] dark:bg-[#29201B] text-[#49382D] dark:text-[#F5EBDD] text-xs font-semibold cursor-pointer"
                        >
                          Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInvitePlayer(f.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713] text-xs font-semibold cursor-pointer"
                        >
                          {activeRoom ? 'Invite to Room' : 'Play Together'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFriend(f.id)}
                          aria-label="Remove friend"
                          className="p-1.5 rounded-xl text-[#76533D] hover:text-red-700 cursor-pointer"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {outgoing.length > 0 && (
                <div className="pt-3 border-t border-[#E8D5BC] dark:border-[#3D3028]">
                  <p className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75] mb-2">
                    Sent Requests ({outgoing.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {outgoing.map((o) => (
                      <div
                        key={o.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] text-xs text-[#49382D] dark:text-[#F5EBDD]"
                      >
                        <CapyAvatarImg avatarId={o.avatarId} sizeClass="w-5 h-5" />
                        <span>{o.username} (Pending)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Search Players */}
          <div className="lg:col-span-5 p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-4">
            <h2 className="font-display text-lg font-bold text-[#49382D] dark:text-[#F5EBDD]">Find Players</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-[#76533D] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] border border-[#E8D5BC] dark:border-[#49382D] text-sm text-[#49382D] dark:text-[#F5EBDD] focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
              />
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
              {searching ? (
                <p className="text-xs text-[#76533D]">Searching...</p>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-[#76533D] dark:text-[#D2C2B0] py-4 text-center">
                  No other players found matching &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                searchResults.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23] flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => handleViewProfile(p.id)}
                      className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                    >
                      <CapyAvatarImg avatarId={p.avatarId} sizeClass="w-9 h-9" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[#49382D] dark:text-[#F5EBDD] truncate">
                          {p.username}
                        </p>
                        <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">
                          Lv {p.level} · {p.xp} XP
                        </p>
                      </div>
                    </button>

                    {p.friendshipStatus === 'friends' ? (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 shrink-0">
                        <UserCheck className="w-3.5 h-3.5" /> Friends
                      </span>
                    ) : p.friendshipStatus === 'outgoing' ? (
                      <span className="text-xs text-[#76533D] dark:text-[#D2C2B0] shrink-0">Requested</span>
                    ) : p.friendshipStatus === 'incoming' ? (
                      <button
                        type="button"
                        onClick={() => handleRespond(p.id, true)}
                        className="px-3 py-1.5 rounded-xl bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713] text-xs font-semibold cursor-pointer shrink-0"
                      >
                        Accept
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendRequest(p.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Add
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* LEADERBOARDS SECTION */
        <div className="p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#B98B68]" />
              <h2 className="font-display text-xl font-bold text-[#49382D] dark:text-[#F5EBDD]">
                {lbTab === 'global' ? 'Global Leaderboard' : 'Friends Leaderboard'}
              </h2>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#E8D5BC]/60 dark:bg-[#352A23]">
              <button
                type="button"
                onClick={() => setLbTab('global')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  lbTab === 'global'
                    ? 'bg-[#FCF8F2] dark:bg-[#29201B] text-[#49382D] dark:text-[#F5EBDD] shadow-sm'
                    : 'text-[#76533D] dark:text-[#D2C2B0]'
                }`}
              >
                Global
              </button>
              <button
                type="button"
                onClick={() => setLbTab('friends')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  lbTab === 'friends'
                    ? 'bg-[#FCF8F2] dark:bg-[#29201B] text-[#49382D] dark:text-[#F5EBDD] shadow-sm'
                    : 'text-[#76533D] dark:text-[#D2C2B0]'
                }`}
              >
                Friends
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#E8D5BC]/60 dark:divide-[#3D3028]">
            {lbRows.map((entry) => {
              const isMe = entry.id === user?.id;
              return (
                <div
                  key={entry.id}
                  className={`py-3.5 px-3 rounded-2xl flex items-center justify-between gap-4 ${
                    isMe ? 'bg-[#E8D5BC]/50 dark:bg-[#352A23]/80' : ''
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-8 font-mono-tabular font-extrabold text-base text-[#76533D] dark:text-[#C99A75]">
                      #{entry.rank}
                    </span>
                    <CapyAvatarImg avatarId={entry.avatarId} sizeClass="w-11 h-11" />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => handleViewProfile(entry.id)}
                        className="font-display font-bold text-sm text-[#49382D] dark:text-[#F5EBDD] hover:underline truncate cursor-pointer"
                      >
                        {entry.username} {isMe ? '(You)' : ''}
                      </button>
                      <p className="text-xs text-[#76533D] dark:text-[#D2C2B0] font-mono-tabular">
                        Level {entry.level} · {entry.wins} wins · {entry.streakDays}d streak
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono-tabular font-extrabold text-base text-[#49382D] dark:text-[#F5EBDD]">
                      {entry.xp} XP
                    </p>
                    <p className="text-xs text-[#76533D] dark:text-[#C99A75]">
                      {entry.perfectGames} zero-mistake
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Player Profile & Stats Modal */}
      {viewedProfile && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <CapyAvatarImg avatarId={viewedProfile.player.avatarId} sizeClass="w-16 h-16" />
                <div>
                  <h3 className="font-display text-xl font-bold text-[#49382D] dark:text-[#F5EBDD]">
                    {viewedProfile.player.username}
                  </h3>
                  <p className="text-xs text-[#76533D] dark:text-[#C99A75] font-mono-tabular">
                    Level {viewedProfile.player.level} · {viewedProfile.player.xp} XP ·{' '}
                    {viewedProfile.player.isOnline ? 'Online' : 'Offline'}
                  </p>
                  <p className="text-xs text-[#49382D]/80 dark:text-[#D2C2B0] mt-1">{viewedProfile.player.bio}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewedProfile(null)}
                aria-label="Close profile"
                className="p-2 rounded-xl text-[#76533D] hover:bg-[#E8D5BC]/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23]">
                <p className="text-[11px] text-[#76533D] dark:text-[#C99A75]">Wins</p>
                <p className="font-mono-tabular font-bold text-base text-[#49382D] dark:text-[#F5EBDD]">
                  {viewedProfile.player.wins}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23]">
                <p className="text-[11px] text-[#76533D] dark:text-[#C99A75]">Streak</p>
                <p className="font-mono-tabular font-bold text-base text-[#49382D] dark:text-[#F5EBDD]">
                  {viewedProfile.player.streakDays}d
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-[#F7F0E5] dark:bg-[#352A23]">
                <p className="text-[11px] text-[#76533D] dark:text-[#C99A75]">Zero-Mistake</p>
                <p className="font-mono-tabular font-bold text-base text-[#49382D] dark:text-[#F5EBDD]">
                  {viewedProfile.player.perfectGames}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <p className="font-semibold text-[#76533D] dark:text-[#C99A75]">Personal Best Times</p>
              <div className="grid grid-cols-2 gap-2 font-mono-tabular text-[#49382D] dark:text-[#F5EBDD]">
                <div className="p-2 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] flex justify-between">
                  <span>Easy</span>
                  <span>{viewedProfile.player.bestTimeEasy ? formatDuration(viewedProfile.player.bestTimeEasy) : '—'}</span>
                </div>
                <div className="p-2 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] flex justify-between">
                  <span>Medium</span>
                  <span>{viewedProfile.player.bestTimeMedium ? formatDuration(viewedProfile.player.bestTimeMedium) : '—'}</span>
                </div>
                <div className="p-2 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] flex justify-between">
                  <span>Hard</span>
                  <span>{viewedProfile.player.bestTimeHard ? formatDuration(viewedProfile.player.bestTimeHard) : '—'}</span>
                </div>
                <div className="p-2 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] flex justify-between">
                  <span>Expert</span>
                  <span>{viewedProfile.player.bestTimeExpert ? formatDuration(viewedProfile.player.bestTimeExpert) : '—'}</span>
                </div>
              </div>
            </div>

            {viewedProfile.achievements.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">
                  Badges ({viewedProfile.achievements.length}/{ACHIEVEMENTS.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {viewedProfile.achievements.map((ua) => {
                    const def = ACHIEVEMENTS.find((a) => a.id === ua.achievementId);
                    if (!def) return null;
                    return (
                      <span
                        key={ua.achievementId}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E8D5BC]/70 dark:bg-[#352A23] text-xs font-medium text-[#49382D] dark:text-[#F5EBDD]"
                      >
                        <Award className="w-3 h-3 text-[#B98B68]" />
                        {def.title}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
