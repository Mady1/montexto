import { useState, useEffect, useRef } from 'react'
import { Bell, HelpCircle, ChevronDown, Search, Check, X, Inbox, Sun, Moon, Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../services/api'

const pageTitles = {
  '/': { title: 'Tableau de bord', sub: "Vue d'ensemble de vos performances" },
  '/campaigns': { title: 'Campagnes', sub: 'Gérez vos campagnes SMS' },
  '/campaigns/new': { title: 'Nouvelle campagne', sub: 'Composez et envoyez' },
  '/catalog': { title: 'Catalogue', sub: 'Modèles de messages' },
  '/groups': { title: 'Groupes', sub: 'Organisez vos contacts' },
  '/contacts': { title: 'Contacts', sub: "Votre carnet d'adresses" },
  '/api-keys': { title: 'API', sub: 'Clés développeur' },
  '/statistics': { title: 'Statistiques', sub: 'Analyse de performance' },
  '/organizations': { title: 'Organisations', sub: 'Gérez les organisations et leurs crédits SMS' },
  '/users': { title: 'Utilisateurs', sub: 'Gérez les comptes et rôles' },
  '/roles': { title: 'Rôles & Permissions', sub: 'Configuration du contrôle d\'accès' },
  '/audit': { title: "Journal d'audit", sub: 'Traçabilité des actions' },
  '/profile': { title: 'Mon profil', sub: 'Gérez vos informations et mot de passe' },
  '/gateways': { title: 'Passerelles SMS', sub: 'Configurez les fournisseurs d\'envoi' },
  '/inbox': { title: 'Boîte de réception', sub: 'SMS reçus et réponses des contacts' },
  '/blacklist': { title: 'Liste noire', sub: 'Numéros exclus et désinscriptions (DND)' },
}

const notifColors = {
  info: 'bg-blue-50 text-blue-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-amber-50 text-amber-600',
  error: 'bg-red-50 text-red-600',
}

export default function Header({ onMenuClick = () => {} }) {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const { title, sub } = pageTitles[location.pathname] || { title: 'Montexto', sub: '' }
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [showNotif, setShowNotif] = useState(false)
  const notifRef = useRef(null)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data.data || [])
      setUnread(res.data.unread || 0)
    } catch {}
  }

  const handleMarkRead = async (id) => {
    await api.patch(`/notifications/${id}/read`)
    fetchNotifications()
  }

  const handleMarkAllRead = async () => {
    await api.patch('/notifications/read-all')
    fetchNotifications()
  }

  return (
    <header className="h-16 surface-translucent backdrop-blur-xl border-b flex items-center justify-between px-4 sm:px-8 sticky top-0 z-10">
      <div className="flex items-center space-x-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
          className="lg:hidden w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all flex-shrink-0 -ml-1"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800 truncate">{title}</h1>
        {sub && <span className="hidden md:inline text-xs text-gray-400 font-medium">— {sub}</span>}
      </div>
      <div className="flex items-center space-x-2">
        <div className="hidden md:flex items-center bg-gray-100 rounded-full px-4 py-2 w-56 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-200">
          <Search className="w-4 h-4 text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="bg-transparent text-sm border-none outline-none flex-1 placeholder:text-gray-400 text-gray-700"
          />
        </div>
        <button
          onClick={toggleTheme}
          aria-label="Basculer le thème"
          className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
        >
          {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>
        <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all">
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all relative"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 bg-gem-pink text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 surface-panel rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">Notifications</span>
                {unread > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> Tout marquer lu
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="text-center py-8">
                    <Inbox className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Aucune notification</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer ${!n.is_read ? 'bg-brand-50/30' : ''}`}
                      onClick={() => !n.is_read && handleMarkRead(n.id)}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.is_read ? 'bg-gray-200' : 'bg-gem-pink'}`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-700">{n.title}</div>
                          {n.message && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</div>}
                          <div className="text-[10px] text-gray-400 mt-1">
                            {new Date(n.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2 text-sm pl-2 ml-1 border-l border-gray-200">
          <div className="w-9 h-9 bg-gradient-to-br from-brand-400 to-gem-purple text-white rounded-full flex items-center justify-center font-semibold text-sm shadow-sm">
            {(user?.firstName?.[0] || 'U').toUpperCase()}
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </header>
  )
}
