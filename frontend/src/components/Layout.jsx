import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      {/* Ambient gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-brand-100/40 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/2 -right-20 w-[300px] h-[300px] bg-gem-purple/10 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-20 left-1/3 w-[350px] h-[350px] bg-gem-pink/10 rounded-full blur-[110px]"></div>
      </div>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 lg:ml-64 relative z-10 min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
