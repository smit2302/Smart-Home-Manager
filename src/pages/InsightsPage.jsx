import { useMemo } from 'react';
import { useHome } from '../context/HomeContext.jsx';
import { findRepeatingHabits } from '../utils/habitFinder.js';
import { buildEfficiencyAdvice } from '../utils/energyAdvisor.js';
import { hasAbility } from '../utils/permissions.js';

export default function InsightsPage() {
  const { home, role, applyAdvice } = useHome();
  const canApply = hasAbility(role, 'routine.manage');
  const habits = useMemo(() => findRepeatingHabits(home), [home]);
  const advice = useMemo(() => buildEfficiencyAdvice(home), [home]);

  return (
    <>
      <header className="page-head">
        <h2>Insights</h2>
        <p>Ideas based on what the simulated logs show: habits worth automating and ways to cut power use.</p>
      </header>

      <section>
        <h3 className="section-title">Habits we noticed</h3>
        <div className="stack">
          {habits.length === 0 && (
            <p className="muted">No repeating pattern yet. When you do the same thing at about the same time on three different days, it shows up here.</p>
          )}
          {habits.map((habit) => (
            <article className="insight" key={habit.id}>
              <div>
                <h4>{habit.title}</h4>
                <p>{habit.detail}</p>
              </div>
              {canApply && (
                <button className="btn btn-primary" onClick={() => applyAdvice({ kind: 'routine', draft: habit.routineDraft })}>
                  Automate at {habit.time}
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3 className="section-title">Ways to save energy</h3>
        <div className="stack">
          {advice.length === 0 && <p className="muted">Usage looks efficient. Turn devices on for a while and check back.</p>}
          {advice.map((item) => (
            <article className="insight" key={item.id}>
              <div>
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
                {item.saving > 0 && <small className="saving">Could save about {item.saving.toFixed(1)} kWh a week</small>}
              </div>
              {canApply && item.fix && (
                <button className="btn btn-primary" onClick={() => applyAdvice(item.fix)}>{item.fix.label}</button>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
