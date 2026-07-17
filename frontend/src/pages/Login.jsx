// Login v2 - direct login without OTP gate
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, Zap, KeyRound, ArrowLeft, ShieldCheck } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const roleColors = {
  super_admin: 'from-red-500 to-rose-600',
  org_admin: 'from-purple-500 to-violet-600',
  resp_com: 'from-blue-500 to-indigo-600',
  operator: 'from-emerald-500 to-teal-600',
  auditor: 'from-amber-500 to-orange-600',
}

export const LOGIN_VERSION = '2.0.0'

export default function Login() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [demoUsers, setDemoUsers] = useState([])
  const [otpStep, setOtpStep] = useState(false)
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [otpDevCode, setOtpDevCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const otpRefs = useRef([])
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/auth/demo-users')
      .then((res) => setDemoUsers(res.data.data || []))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', { email, password })
      login(res.data.token, res.data.user)
      navigate('/')
    } catch (err) {
      if (err.response?.status === 202 || err.response?.data?.otpRequired) {
        const otpRes = await api.post('/auth/otp/request', { email })
        if (otpRes.data.devCode) {
          setOtpDevCode(otpRes.data.devCode)
        }
        setOtpStep(true)
        setTimeout(() => otpRefs.current[0]?.focus(), 100)
      } else {
        setError(err.response?.data?.error || t('login.connectionError'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return
    const newOtp = [...otpCode]
    newOtp[index] = value
    setOtpCode(newOtp)
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length > 0) {
      const newOtp = pasted.split('')
      while (newOtp.length < 6) newOtp.push('')
      setOtpCode(newOtp)
      otpRefs.current[Math.min(pasted.length, 5)]?.focus()
    }
  }

  const handleOtpSubmit = async (e) => {
    e.preventDefault()
    setOtpLoading(true)
    setError('')
    const code = otpCode.join('')
    if (code.length !== 6) {
      setError(t('login.otpIncomplete'))
      setOtpLoading(false)
      return
    }
    try {
      const res = await api.post('/auth/login', { email, password, otp: code })
      login(res.data.token, res.data.user)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || t('login.otpInvalid'))
    } finally {
      setOtpLoading(false)
    }
  }

  const handleOtpResend = async () => {
    try {
      const res = await api.post('/auth/otp/request', { email })
      if (res.data.devCode) setOtpDevCode(res.data.devCode)
      setError('')
    } catch (err) {
      setError(t('login.otpResendError'))
    }
  }

  const backToLogin = () => {
    setOtpStep(false)
    setOtpCode(['', '', '', '', '', ''])
    setOtpDevCode('')
    setError('')
  }

  const quickLogin = (u) => {
    setEmail(u.email)
    setPassword(u.password)
    setError('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gem-bg)] p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-brand-100/50 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-gem-purple/15 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-40 left-1/4 w-[450px] h-[450px] bg-gem-pink/10 rounded-full blur-[110px]"></div>
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="glass-card rounded-3xl p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-400 via-gem-purple to-gem-pink rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Montexto</h1>
            <p className="text-sm text-gray-400 mt-1">{t('login.tagline')}</p>
          </div>

          <h2 className="text-base font-medium text-gray-600 mb-6 text-center">
            {otpStep ? t('login.otpTitle') : t('login.signInTitle')}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2 flex-shrink-0"></span>
              {error}
            </div>
          )}

          {otpStep ? (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-brand-400 to-gem-purple rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
                  <ShieldCheck className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm text-gray-500 mb-1">{t('login.otpSentTo')}</p>
                <p className="text-xs text-gray-400">à <span className="font-medium text-gray-600">{email}</span></p>
                {otpDevCode && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-mono">
                    <KeyRound className="w-3 h-3" />
                    {t('login.otpDemoCode')}: {otpDevCode}
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {otpCode.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-11 h-13 text-center text-xl font-bold rounded-xl border-2 border-gray-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all py-3"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={otpLoading}
                className="gem-btn-primary w-full flex items-center justify-center disabled:opacity-60"
              >
                {otpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t('login.verify')} <ArrowRight className="w-4 h-4 ml-2" /></>}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={backToLogin} className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> {t('login.back')}
                </button>
                <button type="button" onClick={handleOtpResend} className="text-brand-600 hover:text-brand-700 font-medium">
                  {t('login.resendCode')}
                </button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('login.email')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="gem-input w-full pl-11"
                      placeholder="vous@exemple.com"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('login.password')}</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="gem-input w-full pl-11 pr-11"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <Link to="/forgot-password" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                    {t('login.forgotPassword')}
                  </Link>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="gem-btn-primary w-full flex items-center justify-center disabled:opacity-60 mt-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{t('login.signIn')} <ArrowRight className="w-4 h-4 ml-2" /></>}
                </button>
              </form>

              {demoUsers.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-3.5 h-3.5 text-brand-500" />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('login.demoAccounts')}</span>
                  </div>
                  <div className="space-y-2">
                    {demoUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => quickLogin(u)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group text-left"
                      >
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${roleColors[u.roleName] || 'from-gray-400 to-gray-600'} flex items-center justify-center text-white text-xs font-semibold shadow-sm flex-shrink-0`}>
                          {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-700 truncate">
                            {`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}
                          </div>
                          <div className="text-[11px] text-gray-400 truncate">
                            {u.roleDisplayName || u.roleName} {u.organizationName ? `· ${u.organizationName}` : ''}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              {t('login.noAccount')} <Link to="/register" className="text-brand-600 hover:text-brand-700 font-medium">{t('login.createAccount')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
