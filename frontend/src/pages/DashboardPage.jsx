import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { studentApi } from '../services/api'
import { StatCard, Card, Badge, PageSpinner, SectionHeader, Alert } from '../components/ui'
import { ArrowRight, BookOpen, TrendingUp, Bot } from 'lucide-react'
import styles from './DashboardPage.module.css'

function gradeColor(g) {
  if (!g) return 'default'
  if (g.startsWith('A')) return 'success'
  if (g.startsWith('B')) return 'core'
  return 'warning'
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    studentApi.dashboard()
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load dashboard. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSpinner />
  if (error) return <Alert type="danger">{error}</Alert>

  const { student, degree_audit: stats, completed_courses, remaining_courses } = data

  const pct = stats.progress_pct || 0
  const nextCourses = remaining_courses.filter(c => c.course_type === 'Core').slice(0, 3)
  const electivesNext = remaining_courses.filter(c => c.course_type === 'Elective').slice(0, 2)

  return (
    <div className="fade-in">
      <div className={styles.welcome}>
        <div>
          <h1 className={styles.welcomeTitle}>Good morning, {student.name.split(' ')[0]} 👋</h1>
          <p className={styles.welcomeSub}>Here's where you stand in your {student.program_code} program.</p>
        </div>
        <Link to="/advisor" className={styles.advisorCta}>
          <Bot size={15} />
          Ask AI Advisor
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Stats grid */}
      <div className={styles.statsGrid}>
        <StatCard label="Credits completed" value={`${stats.credits_completed || 0} / ${stats.total_required || 40}`} sub={`${pct}% of program done`} accent="teal" />
        <StatCard label="Courses completed" value={stats.courses_completed || 0} sub={`${stats.core_completed || 0} core · ${stats.electives_completed || 0} electives`} accent="blue" />
        <StatCard label="GPA" value={(stats.gpa || 0).toFixed(2)} sub="Cumulative" accent={stats.gpa >= 3.5 ? 'teal' : stats.gpa >= 3.0 ? 'blue' : 'amber'} />
        <StatCard label="Credits remaining" value={stats.credits_remaining || 0} sub="To graduation" accent={stats.credits_remaining || 0 <= 12 ? 'teal' : 'amber'} />
      </div>

      {/* Progress bar */}
      <Card className={styles.progressCard}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>Degree progress</span>
          <span className={styles.progressPct}>{pct}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <div className={styles.progressMeta}>
          <span>{stats.credits_completed || 0} credits earned</span>
          <span>{stats.credits_remaining || 0} credits remaining</span>
        </div>
      </Card>

      <div className={styles.twoCol}>
        {/* Completed courses */}
        <div>
          <SectionHeader
            title="Recently completed"
            action={<Link to="/progress" className={styles.seeAll}>View all <ArrowRight size={12} /></Link>}
          />
          <div className={styles.courseList}>
            {completed_courses.slice(0, 5).map(c => (
              <Card key={c.course_code} className={styles.courseRow}>
                <div className={styles.courseLeft}>
                  <span className={styles.courseCode}>{c.course_code}</span>
                  <div>
                    <p className={styles.courseName}>{c.course_name}</p>
                    <p className={styles.courseMeta}>{c.credits} credits · {c.completed_at}</p>
                  </div>
                </div>
                <div className={styles.courseRight}>
                  <Badge variant={c.course_type === 'Core' ? 'core' : 'elective'}>{c.course_type}</Badge>
                  {c.grade && <Badge variant={gradeColor(c.grade)}>{c.grade}</Badge>}
                </div>
              </Card>
            ))}
            {completed_courses.length === 0 && (
              <Card><p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No courses completed yet.</p></Card>
            )}
          </div>
        </div>

        {/* Up next */}
        <div>
          <SectionHeader
            title="Recommended next"
            action={<Link to="/advisor" className={styles.seeAll}>Get AI picks <ArrowRight size={12} /></Link>}
          />
          <div className={styles.courseList}>
            {[...nextCourses, ...electivesNext].map(c => (
              <Card key={c.course_code} className={styles.courseRow}>
                <div className={styles.courseLeft}>
                  <span className={styles.courseCode}>{c.course_code}</span>
                  <div>
                    <p className={styles.courseName}>{c.course_name}</p>
                    <p className={styles.courseMeta}>{c.credits} credits</p>
                  </div>
                </div>
                <Badge variant={c.course_type === 'Core' ? 'core' : 'elective'}>{c.course_type}</Badge>
              </Card>
            ))}
            {nextCourses.length === 0 && electivesNext.length === 0 && (
              <Card><p style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>🎉 All courses completed!</p></Card>
            )}
          </div>

          <div className={styles.quickLinks}>
            <Link to="/roadmap" className={styles.quickLink}><TrendingUp size={14} /> View roadmap</Link>
            <Link to="/catalog" className={styles.quickLink}><BookOpen size={14} /> Browse catalog</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
