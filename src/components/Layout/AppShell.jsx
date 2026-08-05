import { useState, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import BottomPlayer from './BottomPlayer'
import FullScreenPlayer from './FullScreenPlayer'
import MobileNav from './MobileNav'
import QueueSidebar from '../Queue/QueueSidebar'
import Toast from '../Common/Toast'
import ConfirmModal from '../Common/ConfirmModal'
import './AppShell.css'

function PageFallback() {
  return (
    <div className="app-loading-screen">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  )
}

export default function AppShell({ children }) {
  const { logout } = useAuth()
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false)
    await logout()
  }

  return (
    <div className="app-shell">
      <Sidebar
        onLogoutRequest={() => setShowLogoutModal(true)}
      />

      <main className="main-content">
        <div className="main-content-inner">
          <Suspense fallback={<PageFallback />}>
            {children || <Outlet />}
          </Suspense>
        </div>
      </main>

      <QueueSidebar />
      <BottomPlayer />
      <FullScreenPlayer />
      <MobileNav onLogoutRequest={() => setShowLogoutModal(true)} />
      <Toast />

      <ConfirmModal
        isOpen={showLogoutModal}
        title="Sign Out of SlopiFY?"
        message="Are you sure you want to sign out? You will need to log in again to access your music library."
        confirmText="Sign Out"
        cancelText="Cancel"
        isDanger={true}
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </div>
  )
}
