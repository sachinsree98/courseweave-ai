import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import FloatingChat from '../chat/FloatingChat'
import {
  LayoutDashboard, BookOpen, Map, GitBranch,
  TrendingUp, LogOut, ChevronRight
} from 'lucide-react'
import styles from './AppShell.module.css'

const nav = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/catalog',       icon: BookOpen,         label: 'Course Catalog' },
  { to: '/roadmap',       icon: Map,              label: 'My Roadmap' },
  { to: '/prerequisites', icon: GitBranch,        label: 'Prerequisites' },
  { to: '/progress',      icon: TrendingUp,       label: 'Progress' },
]

const programLabels = {
  MS_DAE: 'Data Analytics Eng.',
  MS_DS:  'Data Science',
  MS_CS:  'Computer Science',
  MS_DA:  'Data Analytics',
  MS_IS:  'Information Systems',
}

export default function AppShell() {
  const { student, logout } = useAuth()
  const navigate = useNavigate()

  const initials = student?.name
    ? student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>CW</div>
          <span className={styles.logoText}>Course<strong>Weave</strong></span>
        </div>

        <nav className={styles.nav}>
          <span className={styles.navSection}>Navigation</span>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
              <ChevronRight size={12} className={styles.chevron} />
            </NavLink>
          ))}
        </nav>

        <div className={styles.userBlock}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{student?.name}</p>
            <p className={styles.userSub}>{programLabels[student?.program_code] || student?.program_code}</p>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Log out">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topnav}>
          <div className={styles.goalChip}>
            <span className={styles.goalDot} />
            Goal: {student?.target_career}
          </div>
          <div className={styles.topRight}>
            <span className={styles.programTag}>{student?.program_code}</span>
            {student?.degree_audit && (
              <span className={styles.progressChip}>
                {student.degree_audit.progress_pct ?? 0}% complete
              </span>
            )}
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>

      <FloatingChat />
    </div>
  )
}
