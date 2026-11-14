import React, { useState } from 'react';
import { Bell, Lock, LogOut, Moon, Music, Sun, Volume2, Zap } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { AvatarGallery } from './AvatarGallery';

export function SettingsView() {
  const { user, updatePreferences, logout } = useAuth();

  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatarId || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  if (!user) return null;

  const handleSaveAvatar = async (avatarId: string) => {
    setSavingAvatar(true);
    try {
      await updatePreferences({ avatarId });
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);
    setSavingProfile(true);
    try {
      await updatePreferences({ username, bio });
      setProfileMsg('Profile saved!');
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    setSavingPw(true);
    try {
      const res = await apiRequest<{ ok: boolean; message: string }>('/api/profile/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPwMsg(res.message);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#49382D] dark:text-[#F5EBDD]">
            Profile & Cafe Settings
          </h1>
          <p className="text-sm text-[#76533D] dark:text-[#D2C2B0] mt-1">
            Customize your capybara avatar, theme, audio ambiance, and account security.
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="px-4 py-2.5 rounded-xl bg-[#E8D5BC] dark:bg-[#352A23] hover:bg-red-100 dark:hover:bg-red-950/50 text-[#49382D] dark:text-[#F5EBDD] hover:text-red-700 font-semibold text-sm flex items-center gap-2 cursor-pointer transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>

      {/* Capybara Avatar Selection Gallery */}
      <section className="p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[#49382D] dark:text-[#F5EBDD]">
            Capybara Avatar Gallery
          </h2>
          <p className="text-xs text-[#76533D] dark:text-[#D2C2B0] mt-0.5">
            Select your favorite capybara avatar. Your choice is saved to your profile across the dashboard, lobby, and leaderboards.
          </p>
        </div>

        <AvatarGallery
          selectedAvatarId={selectedAvatar || user.avatarId}
          username={username || user.username}
          onSelect={setSelectedAvatar}
          onSave={handleSaveAvatar}
          saving={savingAvatar}
        />
      </section>

      {/* Profile Customization & Preferences */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form
          onSubmit={handleSaveProfile}
          className="p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-4"
        >
          <h2 className="font-display text-lg font-bold text-[#49382D] dark:text-[#F5EBDD]">Profile Details</h2>
          {profileErr && <p className="text-xs text-red-700 dark:text-red-300">{profileErr}</p>}
          {profileMsg && <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">{profileMsg}</p>}

          <div>
            <label className="block text-xs font-semibold text-[#76533D] dark:text-[#C99A75] mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] border border-[#E8D5BC] dark:border-[#49382D] text-sm text-[#49382D] dark:text-[#F5EBDD] focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#76533D] dark:text-[#C99A75] mb-1">Email</label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#E8D5BC]/45 dark:bg-[#241C17] border border-[#E8D5BC] dark:border-[#3D3028] text-sm text-[#76533D] dark:text-[#D2C2B0] opacity-80"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#76533D] dark:text-[#C99A75] mb-1">Cafe Bio</label>
            <textarea
              rows={2}
              maxLength={140}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] border border-[#E8D5BC] dark:border-[#49382D] text-sm text-[#49382D] dark:text-[#F5EBDD] focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="w-full py-2.5 px-4 rounded-xl bg-[#76533D] hover:bg-[#5E412F] dark:bg-[#C99A75] dark:hover:bg-[#B98B68] text-[#F7F0E5] dark:text-[#1E1713] font-semibold text-sm cursor-pointer disabled:opacity-60"
          >
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        {/* Theme, Sound & Gameplay Preferences */}
        <div className="p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-4">
          <h2 className="font-display text-lg font-bold text-[#49382D] dark:text-[#F5EBDD]">
            Appearance & Gameplay
          </h2>

          {/* Light / Dark Mode Switch */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              {user.theme === 'dark' ? (
                <Moon className="w-4 h-4 text-[#C99A75]" />
              ) : (
                <Sun className="w-4 h-4 text-[#76533D]" />
              )}
              <div>
                <p className="text-sm font-semibold text-[#49382D] dark:text-[#F5EBDD]">Theme Mode</p>
                <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">
                  {user.theme === 'dark' ? 'Roasted Espresso Dark' : 'Cozy Cream Light'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#E8D5BC]/70 dark:bg-[#352A23]">
              <button
                type="button"
                onClick={() => updatePreferences({ theme: 'light' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  user.theme === 'light'
                    ? 'bg-[#FCF8F2] text-[#49382D] shadow-sm'
                    : 'text-[#76533D] dark:text-[#D2C2B0]'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => updatePreferences({ theme: 'dark' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  user.theme === 'dark'
                    ? 'bg-[#29201B] text-[#F5EBDD] shadow-sm'
                    : 'text-[#76533D] dark:text-[#D2C2B0]'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          {/* Toggle Rows */}
          {[
            {
              label: 'Sound Effects',
              desc: 'Soft taps and chime cues on moves',
              icon: <Volume2 className="w-4 h-4 text-[#B98B68]" />,
              checked: user.soundEnabled,
              onToggle: () => updatePreferences({ soundEnabled: !user.soundEnabled }),
            },
            {
              label: 'Background Cafe Music',
              desc: 'Gentle lo-fi coffee chords while solving',
              icon: <Music className="w-4 h-4 text-[#B98B68]" />,
              checked: user.musicEnabled,
              onToggle: () => updatePreferences({ musicEnabled: !user.musicEnabled }),
            },
            {
              label: 'Game Notifications',
              desc: 'Show live invites and friend alerts',
              icon: <Bell className="w-4 h-4 text-[#B98B68]" />,
              checked: user.notificationsEnabled,
              onToggle: () => updatePreferences({ notificationsEnabled: !user.notificationsEnabled }),
            },
            {
              label: 'Fast Pencil Default',
              desc: 'Start puzzles with blue lightning candidates ON',
              icon: <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
              checked: user.fastPencilDefault,
              onToggle: () => updatePreferences({ fastPencilDefault: !user.fastPencilDefault }),
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 py-2 border-t border-[#E8D5BC]/50 dark:border-[#3D3028]">
              <div className="flex items-center gap-3">
                {item.icon}
                <div>
                  <p className="text-sm font-semibold text-[#49382D] dark:text-[#F5EBDD]">{item.label}</p>
                  <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">{item.desc}</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={item.checked}
                onClick={item.onToggle}
                className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                  item.checked ? 'bg-[#76533D] dark:bg-[#C99A75]' : 'bg-[#E8D5BC] dark:bg-[#352A23]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    item.checked ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <form
        onSubmit={handleChangePassword}
        className="p-6 rounded-3xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#76533D] dark:text-[#C99A75]" />
          <h2 className="font-display text-lg font-bold text-[#49382D] dark:text-[#F5EBDD]">Change Password</h2>
        </div>

        {pwErr && <p className="text-xs text-red-700 dark:text-red-300">{pwErr}</p>}
        {pwMsg && <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">{pwMsg}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#76533D] dark:text-[#C99A75] mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] border border-[#E8D5BC] dark:border-[#49382D] text-sm text-[#49382D] dark:text-[#F5EBDD]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#76533D] dark:text-[#C99A75] mb-1">
              New Password (8+ chars, letter & number)
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] border border-[#E8D5BC] dark:border-[#49382D] text-sm text-[#49382D] dark:text-[#F5EBDD]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingPw}
          className="px-5 py-2.5 rounded-xl bg-[#76533D] hover:bg-[#5E412F] dark:bg-[#C99A75] dark:hover:bg-[#B98B68] text-[#F7F0E5] dark:text-[#1E1713] font-semibold text-sm cursor-pointer disabled:opacity-60"
        >
          {savingPw ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
