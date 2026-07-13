import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Campaigns = lazy(() => import('./pages/Campaigns'))
const NewCampaign = lazy(() => import('./pages/NewCampaign'))
const CampaignDetail = lazy(() => import('./pages/CampaignDetail'))
const QuickSms = lazy(() => import('./pages/QuickSms'))
const Catalog = lazy(() => import('./pages/Catalog'))
const Groups = lazy(() => import('./pages/Groups'))
const Contacts = lazy(() => import('./pages/Contacts'))
const ApiKeys = lazy(() => import('./pages/ApiKeys'))
const Statistics = lazy(() => import('./pages/Statistics'))
const Organizations = lazy(() => import('./pages/Organizations'))
const Users = lazy(() => import('./pages/Users'))
const Roles = lazy(() => import('./pages/Roles'))
const Audit = lazy(() => import('./pages/Audit'))
const Profile = lazy(() => import('./pages/Profile'))
const Gateways = lazy(() => import('./pages/Gateways'))
const Inbox = lazy(() => import('./pages/Inbox'))
const Blacklist = lazy(() => import('./pages/Blacklist'))

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="campaigns" element={<Campaigns />} />
                <Route path="campaigns/new" element={<NewCampaign />} />
                <Route path="campaigns/:id" element={<CampaignDetail />} />
                <Route path="sms" element={<QuickSms />} />
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
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
