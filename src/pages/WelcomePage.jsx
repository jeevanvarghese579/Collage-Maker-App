import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, LogIn, WifiOff, Images, Layers, Frame } from 'lucide-react';
import { APP_NAME, DEVELOPER, DEVELOPER_LINK } from '@/constants';
import { useAppStore } from '@/stores/appStore';
import LoginModal from '@/components/common/LoginModal';

export default function WelcomePage() {
  const navigate = useNavigate();
  const { setMode, addToast } = useAppStore();
  const [loginOpen, setLoginOpen] = useState(false);

  function workOffline() {
    setMode('offline');
    addToast({ type: 'info', message: 'Working offline. Data saved on this device.' });
    navigate('/app/students');
  }

  function onLoginSuccess() {
    navigate('/app/students');
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-brand-50 via-white to-ink-50">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-10 items-center">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-brand-600 text-white shadow-lift mb-6">
              <GraduationCap size={40} />
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-ink-900 leading-tight">
              {APP_NAME}
            </h1>
            <p className="mt-4 text-lg text-ink-600 max-w-md mx-auto md:mx-0">
              Create print-ready school collages with student photos, categories,
              results and custom frames — online or fully offline.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <button className="btn-primary text-base px-6 py-3" onClick={() => setLoginOpen(true)}>
                <LogIn size={18} /> Login
              </button>
              <button
                className="btn-secondary text-base px-6 py-3"
                onClick={workOffline}
              >
                <WifiOff size={18} /> Work Offline
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Images, title: 'High-Res Export', desc: '300 DPI JPEG collages for print' },
              { icon: Layers, title: 'Categories & Results', desc: 'Arts, Sports, grades and positions' },
              { icon: Frame, title: 'Frame Templates', desc: 'Transparent PNG overlays' },
              { icon: WifiOff, title: 'Offline First', desc: 'Works without internet, syncs later' },
            ].map((f) => (
              <div key={f.title} className="card p-5">
                <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
                  <f.icon size={20} />
                </div>
                <h3 className="font-semibold text-ink-900">{f.title}</h3>
                <p className="text-sm text-ink-500 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <footer className="py-6 text-center text-sm text-ink-500 border-t border-ink-100 bg-white/60">
        <p>
          Developed by{' '}
          <a
            href={DEVELOPER_LINK}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-600 hover:underline"
          >
            {DEVELOPER}
          </a>
        </p>
        <a
          href={DEVELOPER_LINK}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-ink-400 hover:text-brand-600"
        >
          Visit itsjeevanvarghese.web.app for more software
        </a>
      </footer>
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={onLoginSuccess}
      />
    </div>
  );
}
