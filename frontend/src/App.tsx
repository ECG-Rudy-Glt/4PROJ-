import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/useAuthStore';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MFAVerificationPage from './pages/MFAVerificationPage';
import DashboardPage from './pages/DashboardPage';
import FilesPage from './pages/FilesPage';
import FavoritesPage from './pages/FavoritesPage';
import SharedPage from './pages/SharedPage';
import TrashPage from './pages/TrashPage';
import SettingsPage from './pages/SettingsPage';
import PlansPage from './pages/PlansPage';
import SharedLinkPage from './pages/SharedLinkPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import AdminPage from './pages/AdminPage';
import OrganizationAdminPage from './pages/OrganizationAdminPage';
import AuditPage from './pages/AuditPage';
import NotFoundPage from './pages/NotFoundPage';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

function App() {
  const { loadUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      loadUser();
    }
  }, [isAuthenticated, loadUser]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/mfa-verify" element={<MFAVerificationPage />} />
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route path="/share/:token" element={<SharedLinkPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/files/:folderId" element={<FilesPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/shared" element={<SharedPage />} />
          <Route path="/invite/folder/:folderId" element={<Navigate to="/shared" replace />} />
          <Route path="/invite/file/:fileId" element={<Navigate to="/shared" replace />} />
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/organization-admin" element={<OrganizationAdminPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
