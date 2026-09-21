import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import SearchPage from './pages/SearchPage'
import ActivityPage from './pages/ActivityPage'
import DocumentsPage from './pages/DocumentsPage'
import FavoritesPage from './pages/FavoritesPage'
import TrashPage from './pages/TrashPage'
import TeamsPage from './pages/TeamsPage'
import UsersPage from './pages/UsersPage'
import RequestsPage from './pages/RequestsPage'
import RolesPage from './pages/RolesPage'
import OrganizationSettingsPage from './pages/OrganizationSettingsPage'
import OrganizationsPage from './pages/OrganizationsPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="recent" element={<Navigate to="/activity" replace />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="trash" element={<TrashPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="organizations/me" element={<OrganizationSettingsPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="requests" element={<RequestsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
