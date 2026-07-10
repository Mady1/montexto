import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import NewCampaign from './pages/NewCampaign'
import Catalog from './pages/Catalog'
import Groups from './pages/Groups'
import Contacts from './pages/Contacts'
import ApiKeys from './pages/ApiKeys'
import Statistics from './pages/Statistics'
import Organizations from './pages/Organizations'
import Users from './pages/Users'
import Roles from './pages/Roles'
import Audit from './pages/Audit'
import Profile from './pages/Profile'
import Gateways from './pages/Gateways'
import Inbox from './pages/Inbox'
import Blacklist from './pages/Blacklist'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/new" element={<NewCampaign />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="groups" element={<Groups />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="api-keys" element={<ApiKeys />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="organizations" element={<Organizations />} />
            <Route path="users" element={<Users />} />
            <Route path="roles" element={<Roles />} />
            <Route path="audit" element={<Audit />} />
            <Route path="profile" element={<Profile />} />
            <Route path="gateways" element={<Gateways />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="blacklist" element={<Blacklist />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
