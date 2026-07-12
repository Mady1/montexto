import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Mail,
  Send,
  BookOpen,
  Users,
  Code,
  BarChart3,
  UserPlus,
  LogOut,
  Sparkles,
  Building2,
  Shield,
  ScrollText,
  KeyRound,
  Server,
  Inbox,
  ShieldBan,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function getBaseMenuItems(t) {
  return [
    { to: '/', icon: LayoutDashboard, label: t('sidebar.nav.dashboard'), color: 'text-brand-500', bg: 'bg-brand-50' },
    { to: '/campaigns', icon: Mail, label: t('sidebar.nav.campaigns'), color: 'text-gem-purple', bg: 'bg-gem-purple/10' },
    { to: '/sms', icon: Send, label: t('sidebar.nav.sms'), color: 'text-brand-500', bg: 'bg-brand-50' },
    { to: '/catalog', icon: BookOpen, label: t('sidebar.nav.catalog'), color: 'text-gem-teal', bg: 'bg-gem-teal/10' },
    { to: '/groups', icon: Users, label: t('sidebar.nav.groups'), color: 'text-gem-amber', bg: 'bg-gem-amber/10' },
    { to: '/contacts', icon: UserPlus, label: t('sidebar.nav.contacts'), color: 'text-gem-pink', bg: 'bg-gem-pink/10' },
    { to: '/inbox', icon: Inbox, label: t('sidebar.nav.inbox'), color: 'text-gem-teal', bg: 'bg-gem-teal/10' },
    { to: '/blacklist', icon: ShieldBan, label: t('sidebar.nav.blacklist'), color: 'text-red-500', bg: 'bg-red-50' },
    { to: '/api-keys', icon: Code, label: t('sidebar.nav.apiKeys'), color: 'text-brand-600', bg: 'bg-brand-50' },
    { to: '/statistics', icon: BarChart3, label: t('sidebar.nav.statistics'), color: 'text-gem-teal', bg: 'bg-gem-teal/10' },
  ]
}

function getAdminMenuItems(t) {
  return [
    { to: '/organizations', icon: Building2, label: t('sidebar.nav.organizations'), color: 'text-brand-600', bg: 'bg-brand-50', roles: ['super_admin'] },
    { to: '/users', icon: Shield, label: t('sidebar.nav.users'), color: 'text-gem-purple', bg: 'bg-gem-purple/10', roles: ['super_admin', 'org_admin'] },
    { to: '/roles', icon: KeyRound, label: t('sidebar.nav.roles'), color: 'text-gem-amber', bg: 'bg-gem-amber/10', roles: ['super_admin'] },
    { to: '/audit', icon: ScrollText, label: t('sidebar.nav.audit'), color: 'text-gem-pink', bg: 'bg-gem-pink/10', roles: ['super_admin', 'auditor'] },
    { to: '/gateways', icon: Server, label: t('sidebar.nav.gateways'), color: 'text-gem-teal', bg: 'bg-gem-teal/10', roles: ['super_admin'] },
  ]
}

export default function Sidebar({ open = false, onClose = () => {} }) {
  const { logout, user, hasRole } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const baseMenuItems = getBaseMenuItems(t)
  const adminMenuItems = getAdminMenuItems(t)
  const visibleAdminItems = adminMenuItems.filter((item) => hasRole(...item.roles))

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`w-64 surface-translucent backdrop-blur-xl border-r flex flex-col h-screen fixed left-0 top-0 z-30 transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
      <div className="h-16 flex items-center px-5 border-b border-gray-100">
        <div className="w-10 h-10 bg-gradient-to-br from-brand-400 via-gem-purple to-gem-pink rounded-2xl flex items-center justify-center mr-3 shadow-md">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-bold text-base text-gray-800">Montexto</span>
          <div className="text-[10px] text-gray-400 font-medium tracking-wide">{t('sidebar.platform')}</div>
        </div>
      </div>

      <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('sidebar.menu')}</div>
        {baseMenuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 transition-all ${isActive ? item.bg : 'bg-transparent group-hover:bg-gray-100'}`}>
                  <item.icon className={`w-4 h-4 ${isActive ? item.color : 'text-gray-400'}`} />
                </div>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}

        {visibleAdminItems.length > 0 && (
          <>
            <div className="px-3 py-2 mt-4 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('sidebar.administration')}</div>
            {visibleAdminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 transition-all ${isActive ? item.bg : 'bg-transparent group-hover:bg-gray-100'}`}>
                      <item.icon className={`w-4 h-4 ${isActive ? item.color : 'text-gray-400'}`} />
                    </div>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <div onClick={() => { navigate('/profile'); onClose() }} className="flex items-center px-3 py-2.5 mb-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
          <div className="w-9 h-9 bg-gradient-to-br from-brand-400 to-gem-purple rounded-full flex items-center justify-center mr-3 text-white text-sm font-semibold shadow-sm">
            {(user?.firstName?.[0] || 'U').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-800 truncate">{user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : t('sidebar.defaultUser')}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 truncate">{user?.email}</span>
            </div>
            {user?.roleDisplayName && (
              <span className="inline-block mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600">
                {user.roleDisplayName}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-all"
        >
          <LogOut className="w-4 h-4 mr-3" />
          {t('sidebar.logout')}
        </button>
      </div>
      </aside>
    </>
  )
}
