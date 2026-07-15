import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ADMIN_EMAIL, AUTH_CONFIGURED, createAuthSession, getAuthSession, verifyCredentials } from '../data/auth.js';
import { hydrateCloudState } from '../data/cloudStore.js';

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30_000;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getAuthSession()) navigate('/', { replace: true });
  }, [navigate]);

  const destination = location.state?.from
    ? `${location.state.from.pathname}${location.state.from.search ?? ''}`
    : '/';

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (lockUntil > Date.now()) {
      setError('Too many attempts. Try again in 30 seconds.');
      return;
    }
    if (!AUTH_CONFIGURED) {
      setError('Administrator login is not configured. Contact the system administrator.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const valid = await verifyCredentials(email, password);
      if (valid) {
        createAuthSession(remember);
        hydrateCloudState()
          .then((changedKeys) => {
            if (changedKeys > 0) window.location.reload();
          })
          .catch(() => {});
        navigate(destination, { replace: true });
        return;
      }

      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setPassword('');
      if (nextAttempts >= MAX_ATTEMPTS) {
        setLockUntil(Date.now() + LOCK_DURATION_MS);
        setAttempts(0);
        setError('Too many attempts. Try again in 30 seconds.');
      } else {
        setError(`Email or password is incorrect. ${MAX_ATTEMPTS - nextAttempts} attempt(s) remaining.`);
      }
    } catch {
      setError('Sign in could not be completed. Check the connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-shell" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">M</span>
          <div><strong>Mom's Pathshala</strong><span>Secure dashboard access</span></div>
        </div>
        <div className="login-copy">
          <span>Administrator</span>
          <h1 id="login-title">Sign in</h1>
          <p>Use your administrator account to continue.</p>
        </div>
        <form className="login-form" onSubmit={submit} noValidate>
          <label className="field-block">
            <span>Email address</span>
            <input className={`lead-input ${error ? 'input-error' : ''}`} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field-block">
            <span>Password</span>
            <div className="password-input-row">
              <input className={`lead-input ${error ? 'input-error' : ''}`} type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </label>
          <label className="toggle-row login-remember">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Remember me for 7 days</span>
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={submitting || lockUntil > Date.now()}>{submitting ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </section>
    </main>
  );
}
