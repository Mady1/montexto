import { useEffect, useState } from 'react'
import { Loader2, Send, CheckCircle, XCircle, TrendingUp, Calendar, Download, FileSpreadsheet } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

function KpiCard({ icon: Icon, label, value, gradient, suffix }) {
  return (
    <div className="gem-card p-6">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-12 h-12 ${gradient} rounded-xl flex items-center justify-center shadow-sm`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-800">{value}{suffix}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

export default function Statistics() {
  const { hasPermission, hasRole } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(null)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchStats()
  }, [startDate, endDate])

  const fetchStats = async () => {
    try {
      const res = await api.get('/stats/dashboard', { params: { startDate, endDate } })
      setStats(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const chartData = stats?.chart?.map((d) => ({
    date: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    messages: d.count
  })) || []

  const pieData = [
    { name: 'Délivrés', value: stats?.sms?.delivered || 0, color: '#22c55e' },
    { name: 'Échoués', value: stats?.sms?.failed || 0, color: '#ef4444' },
    { name: 'En attente', value: stats?.sms?.pending || 0, color: '#f97316' },
  ].filter((d) => d.value > 0)

  const handleExport = async (type) => {
    setExporting(type)
    try {
      const res = await api.get(`/exports/${type}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${type}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Erreur lors de l\'export')
    } finally {
      setExporting(null)
    }
  }

  const exportButtons = [
    { type: 'campaigns', label: 'Campagnes' },
    { type: 'contacts', label: 'Contacts' },
    { type: 'sms-history', label: 'Historique SMS' },
    { type: 'audit', label: 'Audit' },
    ...(hasRole('super_admin') ? [{ type: 'users', label: 'Utilisateurs' }] : []),
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Statistiques</h2>
          <p className="text-sm text-gray-500 mt-1">Analysez les performances de vos campagnes</p>
        </div>
        <div className="flex items-center space-x-2 surface-translucent backdrop-blur rounded-full px-4 py-2 border">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm border-none outline-none text-gray-600 bg-transparent" />
          <span className="text-gray-300">→</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm border-none outline-none text-gray-600 bg-transparent" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard icon={Send} label="Total SMS envoyés" value={stats?.sms?.total_sent || 0} gradient="bg-gradient-to-br from-brand-400 to-brand-600" />
            <KpiCard icon={CheckCircle} label="Délivrés" value={stats?.sms?.delivered || 0} gradient="bg-gradient-to-br from-green-400 to-green-600" />
            <KpiCard icon={XCircle} label="Échoués" value={stats?.sms?.failed || 0} gradient="bg-gradient-to-br from-red-400 to-red-600" />
            <KpiCard icon={TrendingUp} label="Taux de succès" value={stats?.sms?.success_rate || 0} gradient="bg-gradient-to-br from-gem-purple to-purple-700" suffix="%" />
          </div>

          {hasPermission && hasPermission('reporting.export_excel') && (
            <div className="gem-card p-4 mb-6 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mr-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Exporter :
              </div>
              {exportButtons.map((btn) => (
                <button
                  key={btn.type}
                  onClick={() => handleExport(btn.type)}
                  disabled={exporting === btn.type}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  {exporting === btn.type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {btn.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="gem-card p-6 lg:col-span-2">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Messages envoyés par jour</h3>
              {chartData.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Send className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  Aucune donnée pour cette période
                </div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e8eaed', fontSize: '13px' }} />
                      <Bar dataKey="messages" fill="#4285f4" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="gem-card p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Répartition des statuts</h3>
              {pieData.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                  Aucune donnée
                </div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e8eaed', fontSize: '13px' }} />
                      <Legend wrapperStyle={{ fontSize: '13px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
