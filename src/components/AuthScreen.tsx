import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Coffee, Eye, EyeOff, KeyRound, Users, Zap } from 'lucide-react';
import { CAPYBARA_AVATARS, DEFAULT_AVATAR_ID } from '../shared/avatars';
import { UserProfile } from '../shared/types';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { BrandMark } from './BrandMark';

type AuthMode = 'login' | 'signup' | 'forgot';

export function AuthScreen() {
  const { loginWithAuthResponse } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');

  // Login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID);

  // Forgot password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [devCodeNotice, setDevCodeNotice] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const pwHasLength = (mode === 'signup' ? signupPassword : resetNewPassword).length >= 8;
  const pwHasLetter = /[A-Za-z]/.test(mode === 'signup' ? signupPassword : resetNewPassword);
  const pwHasNumber = /[0-9]/.test(mode === 'signup' ? signupPassword : resetNewPassword);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      loginWithAuthResponse(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, email, password: signupPassword, avatarId }),
      });
      loginWithAuthResponse(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setDevCodeNotice(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ ok: boolean; message: string; verificationCode?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail }),
      });
      setResetStep('verify');
      setSuccessMsg(res.message);
      if (res.verificationCode) {
        setDevCodeNotice(res.verificationCode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start password reset.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ ok: boolean; message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword: resetNewPassword }),
      });
      setSuccessMsg(res.message);
      setMode('login');
      setIdentifier(resetEmail);
      setResetStep('request');
      setResetCode('');
      setResetNewPassword('');
      setDevCodeNotice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F0E5] text-[#49382D] flex flex-col justify-between px-4 py-8 sm:px-8">
      <div className="max-w-6xl w-full mx-auto flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left Coffee Shop Showcase */}
          <div className="lg:col-span-6 flex flex-col justify-between p-7 sm:p-10 rounded-3xl bg-[#E8D5BC]/65 border border-[#B98B68]/25">
            <div className="space-y-6">
              <BrandMark size="lg" />
              <div className="space-y-3">
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#49382D] tracking-tight leading-tight text-balance">
                  Pull up a chair, pour a latte, and solve Sudoku together.
                </h1>
                <p className="text-base text-[#49382D]/85 leading-relaxed max-w-lg">
                  PLAYCOTEDOKU is a warm online Sudoku cafe where you can unwind solo, keep your daily streak alive, or team up and race friends in real time.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-[#FCF8F2] border border-[#B98B68]/20">
                  <Zap className="w-4 h-4 text-[#2563EB] mb-1.5" />
                  <p className="font-display font-bold text-sm text-[#49382D]">Fast Pencil</p>
                  <p className="text-xs text-[#76533D]">Auto candidates & quick entry</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#FCF8F2] border border-[#B98B68]/20">
                  <Users className="w-4 h-4 text-[#76533D] mb-1.5" />
                  <p className="font-display font-bold text-sm text-[#49382D]">Co-op & 1v1</p>
                  <p className="text-xs text-[#76533D]">Live shared rooms & races</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#FCF8F2] border border-[#B98B68]/20">
                  <Coffee className="w-4 h-4 text-[#B98B68] mb-1.5" />
                  <p className="font-display font-bold text-sm text-[#49382D]">Daily Brew</p>
                  <p className="text-xs text-[#76533D]">Same global puzzle daily</p>
                </div>
              </div>
            </div>

            {/* Capybara Crew Showcase */}
            <div className="mt-8 pt-6 border-t border-[#B98B68]/25">
              <p className="text-xs font-semibold text-[#76533D] mb-3">
                Choose your cozy capybara profile avatar after joining:
              </p>
              <div className="grid grid-cols-6 gap-2.5">
                {CAPYBARA_AVATARS.map((av) => (
                  <div key={av.id} className="group relative aspect-square rounded-2xl overflow-hidden border border-[#B98B68]/35 bg-[#FCF8F2]">
                    <img
                      src={av.imageUrl}
                      alt={av.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Auth Form Card */}
          <div className="lg:col-span-6 flex items-center">
            <div className="w-full bg-[#FCF8F2] rounded-3xl p-7 sm:p-9 shadow-sm border border-[#E8D5BC]">
              {/* Mode Switcher */}
              <div className="flex items-center gap-1 p-1 bg-[#E8D5BC]/60 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${
                    mode === 'login' ? 'bg-[#FCF8F2] text-[#49382D] shadow-sm' : 'text-[#76533D] hover:text-[#49382D]'
                  }`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${
                    mode === 'signup' ? 'bg-[#FCF8F2] text-[#49382D] shadow-sm' : 'text-[#76533D] hover:text-[#49382D]'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
                  {successMsg}
                </div>
              )}

              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-[#49382D]">Welcome back</h2>
                    <p className="text-sm text-[#76533D] mt-0.5">Sign in to resume your puzzles and join friends.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#49382D] mb-1.5">Email or Username</label>
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="latte_lover or you@example.com"
                      className="w-full px-4 py-3 rounded-xl bg-[#F7F0E5] border border-[#E8D5BC] text-[#49382D] placeholder:text-[#76533D]/50 focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-semibold text-[#49382D]">Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setError(null);
                          setSuccessMsg(null);
                        }}
                        className="text-xs font-semibold text-[#76533D] hover:text-[#49382D] underline underline-offset-2 cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full px-4 py-3 pr-11 rounded-xl bg-[#F7F0E5] border border-[#E8D5BC] text-[#49382D] placeholder:text-[#76533D]/50 focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#76533D] hover:text-[#49382D] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-5 rounded-xl bg-[#76533D] hover:bg-[#5F412F] text-[#F7F0E5] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <span>{submitting ? 'Brewing your session...' : 'Enter PLAYCOTEDOKU'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {mode === 'signup' && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-[#49382D]">Join the table</h2>
                    <p className="text-sm text-[#76533D] mt-0.5">Create your PLAYCOTEDOKU account and pick a capybara avatar.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-sm font-semibold text-[#49382D] mb-1">Username</label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="capy_solver"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F0E5] border border-[#E8D5BC] text-[#49382D] placeholder:text-[#76533D]/50 focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#49382D] mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F0E5] border border-[#E8D5BC] text-[#49382D] placeholder:text-[#76533D]/50 focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#49382D] mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="Create a strong password"
                        className="w-full px-3.5 py-2.5 pr-11 rounded-xl bg-[#F7F0E5] border border-[#E8D5BC] text-[#49382D] placeholder:text-[#76533D]/50 focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#76533D] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className={`inline-flex items-center gap-1 ${pwHasLength ? 'text-emerald-700 font-medium' : 'text-[#76533D]/70'}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> 8+ characters
                      </span>
                      <span className={`inline-flex items-center gap-1 ${pwHasLetter ? 'text-emerald-700 font-medium' : 'text-[#76533D]/70'}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> At least 1 letter
                      </span>
                      <span className={`inline-flex items-center gap-1 ${pwHasNumber ? 'text-emerald-700 font-medium' : 'text-[#76533D]/70'}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> At least 1 number
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#49382D] mb-2">Pick Your Capybara Avatar</label>
                    <div className="grid grid-cols-6 gap-2">
                      {CAPYBARA_AVATARS.map((av) => {
                        const selected = av.id === avatarId;
                        return (
                          <button
                            key={av.id}
                            type="button"
                            onClick={() => setAvatarId(av.id)}
                            title={av.name}
                            className={`aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                              selected ? 'border-[#76533D] ring-2 ring-[#B98B68]/60 scale-105' : 'border-transparent opacity-80 hover:opacity-100'
                            }`}
                          >
                            <img src={av.imageUrl} alt={av.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 px-5 rounded-xl bg-[#76533D] hover:bg-[#5F412F] text-[#F7F0E5] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <span>{submitting ? 'Creating account...' : 'Create Account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {mode === 'forgot' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="w-5 h-5 text-[#76533D]" />
                    <h2 className="font-display text-2xl font-bold text-[#49382D]">Reset Password</h2>
                  </div>

                  {resetStep === 'request' ? (
                    <form onSubmit={handleRequestReset} className="space-y-4">
                      <p className="text-sm text-[#76533D]">
                        Enter the email address linked to your PLAYCOTEDOKU account to receive a 6-digit reset code.
                      </p>
                      <div>
                        <label className="block text-sm font-semibold text-[#49382D] mb-1.5">Email Address</label>
                        <input
                          type="email"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full px-4 py-3 rounded-xl bg-[#F7F0E5] border border-[#E8D5BC] text-[#49382D] focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 px-5 rounded-xl bg-[#76533D] hover:bg-[#5F412F] text-[#F7F0E5] font-semibold text-sm cursor-pointer disabled:opacity-60"
                      >
                        {submitting ? 'Generating code...' : 'Send Reset Code'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleConfirmReset} className="space-y-4">
                      {devCodeNotice && (
                        <div className="p-3 rounded-xl bg-[#E8D5BC]/80 border border-[#B98B68] text-sm text-[#49382D]">
                          Your verification code: <span className="font-mono-tabular font-bold">{devCodeNotice}</span>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-semibold text-[#49382D] mb-1">6-Digit Verification Code</label>
                        <input
                          type="text"
                          required
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value)}
                          placeholder="123456"
                          className="w-full px-4 py-2.5 rounded-xl bg-[#F7F0E5] border border-[#E8D5BC] text-[#49382D] font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#49382D] mb-1">New Password</label>
                        <input
                          type="password"
                          required
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          placeholder="8+ chars, letter & number"
                          className="w-full px-4 py-2.5 rounded-xl bg-[#F7F0E5] border border-[#E8D5BC] text-[#49382D] focus:outline-none focus:ring-2 focus:ring-[#B98B68]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 px-5 rounded-xl bg-[#76533D] hover:bg-[#5F412F] text-[#F7F0E5] font-semibold text-sm cursor-pointer disabled:opacity-60"
                      >
                        {submitting ? 'Updating password...' : 'Confirm New Password'}
                      </button>
                    </form>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setSuccessMsg(null);
                      setResetStep('request');
                    }}
                    className="text-sm font-semibold text-[#76533D] hover:text-[#49382D] underline cursor-pointer"
                  >
                    Back to Log In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
