import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  GameInvite,
  MultiplayerRoomView,
  UnlockedAchievement,
  UserProfile,
} from '../shared/types';
import { apiRequest, getStoredToken, setStoredToken } from '../utils/api';
import { setAudioPreferences } from '../utils/sound';

interface RoomListing {
  code: string;
  name: string;
  mode: 'coop' | 'race';
  difficulty: string;
  status: string;
  playerCount: number;
  hostUsername: string;
  hostAvatarId: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  achievements: UnlockedAchievement[];
  loading: boolean;
  wsConnected: boolean;
  activeRoom: MultiplayerRoomView | null;
  lobbyRooms: RoomListing[];
  pendingInvites: GameInvite[];
  wsError: string | null;
  friendSignal: number;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  refreshUser: () => Promise<void>;
  loginWithAuthResponse: (token: string, user: UserProfile) => void;
  logout: () => Promise<void>;
  updatePreferences: (patch: Partial<UserProfile>) => Promise<UserProfile>;
  sendWs: (payload: Record<string, unknown>) => void;
  dismissInvite: (roomCode: string) => void;
  clearWsError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [achievements, setAchievements] = useState<UnlockedAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeRoom, setActiveRoom] = useState<MultiplayerRoomView | null>(null);
  const [lobbyRooms, setLobbyRooms] = useState<RoomListing[]>([]);
  const [pendingInvites, setPendingInvites] = useState<GameInvite[]>([]);
  const [wsError, setWsError] = useState<string | null>(null);
  const [friendSignal, setFriendSignal] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const applyThemeAndAudio = useCallback((profile: UserProfile | null) => {
    if (profile) {
      document.documentElement.classList.toggle('dark', profile.theme === 'dark');
      setAudioPreferences(profile.soundEnabled, profile.musicEnabled);
    } else {
      document.documentElement.classList.remove('dark');
      setAudioPreferences(true, false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: UserProfile; achievements: UnlockedAchievement[] }>('/api/auth/me');
      setUser(data.user);
      setAchievements(data.achievements || []);
      applyThemeAndAudio(data.user);
    } catch {
      setUser(null);
      setAchievements([]);
      setStoredToken(null);
      applyThemeAndAudio(null);
    } finally {
      setLoading(false);
    }
  }, [applyThemeAndAudio]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const connectWebSocket = useCallback(() => {
    if (!user) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const token = getStoredToken();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setWsConnected(true);
      setWsError(null);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'room:state') {
          setActiveRoom(msg.room);
          if (
            msg.room &&
            typeof msg.room.myAccountHintCredits === 'number' &&
            typeof msg.room.myAccountPencilCredits === 'number'
          ) {
            setUser((prev) =>
              prev
                ? {
                    ...prev,
                    hintCredits: msg.room.myAccountHintCredits,
                    pencilCredits: msg.room.myAccountPencilCredits,
                  }
                : prev
            );
          }
        } else if (msg.type === 'room:left') {
          setActiveRoom(null);
        } else if (msg.type === 'room:list') {
          setLobbyRooms(msg.rooms || []);
        } else if (msg.type === 'invite:received') {
          setPendingInvites((prev) => {
            const filtered = prev.filter((i) => i.roomCode !== msg.invite.roomCode);
            return [msg.invite, ...filtered];
          });
        } else if (msg.type === 'presence:update' || msg.type === 'friends:updated' || msg.type === 'friends:request') {
          setFriendSignal((n) => n + 1);
        } else if (msg.type === 'error') {
          setWsError(msg.message || 'Multiplayer error occurred.');
        }
      } catch {
        // ignore parse error
      }
    };

    socket.onclose = () => {
      setWsConnected(false);
      wsRef.current = null;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, 2000);
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      connectWebSocket();
    } else {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setActiveRoom(null);
      setWsConnected(false);
    }
    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    };
  }, [user, connectWebSocket]);

  const sendWs = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      setWsError('Connecting to live server... please try again in a moment.');
    }
  }, []);

  const loginWithAuthResponse = useCallback(
    (token: string, nextUser: UserProfile) => {
      setStoredToken(token);
      setUser(nextUser);
      applyThemeAndAudio(nextUser);
      refreshUser();
    },
    [applyThemeAndAudio, refreshUser]
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    setAchievements([]);
    setActiveRoom(null);
    setPendingInvites([]);
    applyThemeAndAudio(null);
  }, [applyThemeAndAudio]);

  const updatePreferences = useCallback(
    async (patch: Partial<UserProfile>) => {
      const res = await apiRequest<{ user: UserProfile }>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setUser(res.user);
      applyThemeAndAudio(res.user);
      return res.user;
    },
    [applyThemeAndAudio]
  );

  const dismissInvite = useCallback((roomCode: string) => {
    setPendingInvites((prev) => prev.filter((i) => i.roomCode !== roomCode));
  }, []);

  const clearWsError = useCallback(() => setWsError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        achievements,
        loading,
        wsConnected,
        activeRoom,
        lobbyRooms,
        pendingInvites,
        wsError,
        friendSignal,
        setUser,
        refreshUser,
        loginWithAuthResponse,
        logout,
        updatePreferences,
        sendWs,
        dismissInvite,
        clearWsError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
