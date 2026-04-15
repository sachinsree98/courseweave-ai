import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, BookOpen, Map,
  TrendingUp, LogOut, Bot, ChevronRight, Sun, Moon
} from 'lucide-react'
import styles from './AppShell.module.css'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/advisor', icon: Bot, label: 'AI Advisor' },
  { to: '/catalog', icon: BookOpen, label: 'Course Catalog' },
  { to: '/roadmap', icon: Map, label: 'My Roadmap' },
  { to: '/progress', icon: TrendingUp, label: 'Progress' },
]

const programLabels = {
  MS_DAE: 'Data Analytics Eng.',
  MS_DS: 'Data Science',
  MS_CS: 'Computer Science',
  MS_DA: 'Data Analytics',
  MS_IS: 'Information Systems',
}

export default function AppShell() {
  const { student, logout } = useAuth()
  const navigate = useNavigate()

  const [theme, setTheme] = useState(
    () => localStorage.getItem('cw_theme') || 'light'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('cw_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  const initials = student?.name
    ? student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const handleLogout = () => { logout(); navigate('/') }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <img src="/logo_bg.png" alt="CourseWeave" className={styles.logoImg} />
        </div>

        <nav className={styles.nav}>
          <span className={styles.navSection}>Menu</span>
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
          <div className={styles.breadcrumb}>
            <span className={styles.goalChip}>
              <span className={styles.goalDot} />
              Goal: {student?.target_career}
            </span>
          </div>
          <div className={styles.topRight}>
            <span className={styles.programTag}>{student?.program_code}</span>
            {student?.degree_path && (
              <span className={styles.trackTag}>
                {student.degree_path.charAt(0).toUpperCase() + student.degree_path.slice(1)} track
              </span>
            )}
            <button
              className={styles.themeToggle}
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
