import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import BottomPlayer from './BottomPlayer'
import MobileNav from './MobileNav'
import ConfirmModal from '../Common/ConfirmModal'
import './AppShell.css'

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
          {children}
        </div>
      </main>

      <BottomPlayer />
      <MobileNav onLogoutRequest={() => setShowLogoutModal(true)} />

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
