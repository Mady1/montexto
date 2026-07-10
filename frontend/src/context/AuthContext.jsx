import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

function normalizeUser(data) {
  if (!data) return null
  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name || data.firstName || '',
    lastName: data.last_name || data.lastName || '',
    phone: data.phone || '',
    status: data.status || 'active',
    organizationId: data.organization_id || data.organizationId || null,
    organizationName: data.organization_name || null,
    orgSmsBalance: data.org_sms_balance ?? null,
    roleId: data.role_id || data.roleId || null,
    roleName: data.role_name || data.roleName || null,
    roleDisplayName: data.role_display_name || data.roleDisplayName || null,
    lastLogin: data.last_login || data.lastLogin || null,
    createdAt: data.created_at || data.createdAt || null,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.get('/auth/me')
        .then((res) => setUser(normalizeUser(res.data)))
        .catch(() => {
          localStorage.removeItem('token')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback((token, userData) => {
    localStorage.setItem('token', token)
    setUser(normalizeUser(userData))
  }, [])

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {})
    localStorage.removeItem('token')
    setUser(null)
  }, [])

  const hasRole = useCallback((...roles) => {
    return user?.roleName && roles.includes(user.roleName)
  }, [user])

  const hasPermission = useCallback((perm) => {
    if (!user) return false
    if (user.roleName === 'super_admin') return true
    return user._permissions?.includes(perm) ?? false
  }, [user])

  const refreshUser = useCallback(() => {
    return api.get('/auth/me').then((res) => {
      const normalized = normalizeUser(res.data)
      setUser(normalized)
      return normalized
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasRole, hasPermission, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
