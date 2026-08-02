import { useState } from 'react'
import Sidebar from './Sidebar'
import BottomPlayer from './BottomPlayer'
import MobileNav from './MobileNav'
import './AppShell.css'

export default function AppShell({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main className="main-content">
        <div className="main-content-inner">
          {children}
        </div>
      </main>

      <BottomPlayer />
      <MobileNav />
    </div>
  )
}
