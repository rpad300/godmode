/**
 * Purpose:
 *   Standalone authentication page supporting login, registration, and password
 *   reset flows. Redirects to /dashboard if the user is already authenticated.
 *
 * Responsibilities:
 *   - Render a centered auth card with login/register tab switcher and forgot-password mode
 *   - Validate inputs (password match, min length) before submitting
 *   - Delegate auth operations to the AuthContext (login, register, forgotPassword)
 *   - Show loading spinner while auth state is being determined
 *   - Redirect authenticated users away from this page via <Navigate>
 *
 * Key dependencies:
 *   - useAuth (AuthContext): isAuthenticated, login, register, forgotPassword
 *   - react-router-dom Navigate: declarative redirect for authenticated users
 *
 * Side effects:
 *   - Network: authentication calls via AuthContext
 *   - Navigation: redirects to /dashboard on successful login or if already authenticated
 *
 * Notes:
 *   - This is the route-based login page; LandingPage.tsx also contains an embedded
 *     auth form for unauthenticated users arriving at the root route.
 *   - Password minimum length is 6 characters, enforced client-side.
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Zap, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'login' | 'register' | 'forgot';

export default function LoginPage() {
  const { isAuthenticated, isLoading, login, register, forgotPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        toast.success('Welcome back!');
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          toast.error('Passwords do not match');
          setSubmitting(false);
          return;
        }
        if (password.length < 6) {
          toast.error('Password must be at least 6 characters');
          setSubmitting(false);
          return;
        }
        await register(email, password);
        toast.success('Registration successful! Please check your email to confirm.');
        setMode('login');
      } else if (mode === 'forgot') {
        await forgotPassword(email);
        toast.success('If an account exists, a password reset email has been sent.');
        setMode('login');
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground tracking-tight">GodMode</span>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl border border-border p-8 shadow-xl">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-foreground">
              {mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create account' : 'Reset password'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === 'login' ? 'Sign in to your account' : mode === 'register' ? 'Get started with GodMode' : 'Enter your email to receive a reset link'}
            </p>
          </div>

          {/* Mode switcher for login/register */}
          {mode !== 'forgot' && (
            <div className="flex mb-6 bg-secondary rounded-lg p-1">
              {(['login', 'register'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setMode(tab)}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    mode === tab
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'Min 6 characters' : 'Your password'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full px-3 py-2.5 pr-10 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting
                ? (mode === 'login' ? 'Signing in...' : mode === 'register' ? 'Creating account...' : 'Sending...')
                : (mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link')
              }
            </button>
          </form>

          {/* Links */}
          <div className="mt-4 text-center">
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Forgot password?
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back to sign in
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
