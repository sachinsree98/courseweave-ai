import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password.')
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <div className={styles.logoMark}>CW</div>
          <span className={styles.logoText}>Course<strong>Weave</strong> <span className={styles.ai}>AI</span></span>
        </div>
        <h1 className={styles.heroTitle}>Your academic path,<br />intelligently planned.</h1>
        <p className={styles.heroSub}>AI-powered course recommendations tailored to your career goals and program requirements.</p>
        <div className={styles.features}>
          {['Career-aligned course picks', 'Prerequisite auto-validation', 'Semester-by-semester roadmap', 'Real job market data'].map(f => (
            <div key={f} className={styles.featureItem}>
              <div className={styles.featureDot} />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Welcome back</h2>
          <p className={styles.formSub}>Sign in to your CourseWeave account</p>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={submit} className={styles.form}>
            <div className={styles.field}>
              <label>NEU Email</label>
              <input
                type="email"
                name="email"
                placeholder="you@northeastern.edu"
                value={form.email}
                onChange={handle}
                required
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label>Password</label>
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handle}
                required
              />
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Sign in'}
            </button>
          </form>

          <p className={styles.switchLink}>
            Don't have an account? <Link to="/signup">Create one →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
