import { useEffect, useRef, useState } from 'react';
import { useHome } from '../context/HomeContext.jsx';
import { VOICE_EXAMPLES } from '../utils/voiceParser.js';

export default function VoicePage() {
  const { home, sendVoiceCommand } = useHome();
  const [typed, setTyped] = useState('');
  const logEnd = useRef(null);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [home.commandHistory.length]);

  function submitCommand(text) {
    if (!text.trim()) return;
    sendVoiceCommand(text);
    setTyped('');
  }

  return (
    <>
      <header className="page-head">
        <h2>Voice control</h2>
        <p>Type a command the way you would say it. Your role decides what the command is allowed to change.</p>
      </header>

      <section className="panel voice-panel">
        <div className="voice-log">
          {home.commandHistory.length === 0 && <p className="muted">Nothing said yet. Try one of the examples below.</p>}
          {home.commandHistory.map((entry) => (
            <div key={entry.id} className="voice-exchange">
              <p className="voice-said">{entry.text}</p>
              <p className={`voice-reply ${entry.ok ? '' : 'voice-reply-bad'}`}>{entry.reply}</p>
            </div>
          ))}
          <div ref={logEnd} />
        </div>

        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitCommand(typed);
          }}
        >
          <input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder='Try "turn off all lights"' aria-label="Voice command" />
          <button className="btn btn-primary">Send</button>
        </form>

        <div className="chip-row">
          {VOICE_EXAMPLES.map((example) => (
            <button key={example} className="chip chip-button" onClick={() => submitCommand(example)}>{example}</button>
          ))}
        </div>
      </section>
    </>
  );
}
