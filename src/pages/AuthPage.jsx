import { useState } from 'react';
import { useHome } from '../context/HomeContext.jsx';

export default function AuthPage() {
  const { register, login } = useHome();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errorText, setErrorText] = useState('');
  const [busy, setBusy] = useState(false);

  const updateField = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    const result =
      mode === 'login' ? await login(form.email, form.password) : await register(form.name, form.email, form.password);
    setBusy(false);
    setErrorText(result.ok ? '' : result.message);
  }

  return (
    <div className="auth-screen">
      <section className="auth-story">
        <span className="brand-mark brand-mark-large" aria-hidden="true" />
        <h1>Every light, fan and lock in one calm place.</h1>
        <p>
          SmartHome Manager simulates a connected home: create devices, link them, schedule routines and watch the
          energy meter move. Nothing here touches real hardware.
        </p>
        <ul>
          <li>Rooms, groups and per-device settings</li>
          <li>Routines, alerts and an emergency switch</li>
          <li>Admin, Guest and Child access levels</li>
        </ul>
      </section>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        {mode === 'register' && (
          <label className="field">
            <span>Your name</span>
            <input value={form.name} onChange={updateField('name')} autoComplete="name" required />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={updateField('email')} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={updateField('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </label>
        {errorText && <p className="form-error">{errorText}</p>}
        <button className="btn btn-primary btn-wide" disabled={busy}>
          {mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setErrorText('');
          }}
        >
          {mode === 'login' ? 'New here? Create an account' : 'Already registered? Log in'}
        </button>
      </form>
    </div>
  );
}
