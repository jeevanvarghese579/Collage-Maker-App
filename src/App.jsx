import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { useBootstrap } from '@/hooks/useApp';
import { FullPageSpinner } from '@/components/common/Spinner';
import ToastContainer from '@/components/common/ToastContainer';
import LoginModal from '@/components/common/LoginModal';
import WelcomePage from '@/pages/WelcomePage';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StudentsPage from '@/pages/StudentsPage';
import CategoriesPage from '@/pages/CategoriesPage';
import ParticipationPage from '@/pages/ParticipationPage';
import ResultsPage from '@/pages/ResultsPage';
import CollagePage from '@/pages/CollagePage';
import FramesPage from '@/pages/FramesPage';
import SettingsPage from '@/pages/SettingsPage';

export default function App() {
  useBootstrap();
  const isAuthReady = useAppStore((s) => s.isAuthReady);
  const [loginOpen, setLoginOpen] = useState(false);

  if (!isAuthReady) {
    return <FullPageSpinner label="Starting Collage Maker…" />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route
          path="/app"
          element={<DashboardLayout onLoginClick={() => setLoginOpen(true)} />}
        >
          <Route index element={<Navigate to="students" replace />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="participation" element={<ParticipationPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="collage" element={<CollagePage />} />
          <Route path="frames" element={<FramesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
      />
    </BrowserRouter>
  );
}
