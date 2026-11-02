import { useState } from 'react';
import { useHome } from '../context/HomeContext.jsx';

export default function HouseholdSetup() {
  const { account, createHousehold, joinHousehold, logout } = useHome();
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');

  return (
    <div className="setup-screen">
      <header className="setup-head">
        <h1>Hi {account.name}, let's set up your home.</h1>
        <button className="btn btn-quiet" onClick={logout}>Log out</button>
      </header>

      <div className="setup-grid">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            const result = createHousehold(householdName);
            setCreateError(result.ok ? '' : result.message);
          }}
        >
          <h2>Create a household</h2>
          <p>You become the Admin and can add rooms, devices and family members.</p>
          <label className="field">
            <span>Household name</span>
            <input value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="Dhandhukiya Residence" />
          </label>
          {createError && <p className="form-error">{createError}</p>}
          <button className="btn btn-primary">Create household</button>
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            const result = joinHousehold(inviteCode);
            setJoinError(result.ok ? '' : result.message);
          }}
        >
          <h2>Join with an invite code</h2>
          <p>Ask the household Admin for the six-character code. You join as a Guest until they change your role.</p>
          <label className="field">
            <span>Invite code</span>
            <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} maxLength={6} placeholder="K7P2QM" />
          </label>
          {joinError && <p className="form-error">{joinError}</p>}
          <button className="btn btn-primary">Join household</button>
        </form>
      </div>
    </div>
  );
}
