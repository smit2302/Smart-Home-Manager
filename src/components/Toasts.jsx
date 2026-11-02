import { useHome } from '../context/HomeContext.jsx';

export default function Toasts() {
  const { toasts } = useHome();
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.ok ? 'toast-good' : 'toast-bad'}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
