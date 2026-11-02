import { useHome } from '../context/HomeContext.jsx';
import { ROLES, ROLE_NOTES, hasAbility } from '../utils/permissions.js';

export default function MembersPage() {
  const { home, members, account, role, notify, changeMemberRole, removeMember } = useHome();
  const canManage = hasAbility(role, 'members.manage');

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(home.inviteCode);
      notify('Invite code copied.');
    } catch {
      notify(`Invite code: ${home.inviteCode}`);
    }
  }

  return (
    <>
      <header className="page-head">
        <h2>Members and roles</h2>
        <p>Share the invite code with people who live in the home. New members start as Guests.</p>
      </header>

      <section className="panel invite-panel">
        <div>
          <span className="muted">Invite code</span>
          <strong className="invite-code">{home.inviteCode}</strong>
        </div>
        <button className="btn btn-quiet" onClick={copyCode}>Copy code</button>
      </section>

      <section className="panel table-panel">
        <h3>People in this household</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.name}{member.id === account.id && <small> (you)</small>}</td>
                <td>{member.email}</td>
                <td>
                  {canManage ? (
                    <select value={member.role} onChange={(event) => changeMemberRole(member.id, event.target.value)} aria-label={`Role for ${member.name}`}>
                      {ROLES.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  ) : (
                    member.role
                  )}
                </td>
                <td>
                  {canManage && member.id !== account.id && (
                    <button className="btn btn-quiet btn-quiet-danger" onClick={() => removeMember(member.id)}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="room-grid">
        {ROLES.map((item) => (
          <div className="panel" key={item}>
            <h3>{item}</h3>
            <p className="muted">{ROLE_NOTES[item]}</p>
          </div>
        ))}
      </section>
    </>
  );
}
