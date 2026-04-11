import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { coursesApi } from '../services/api'
import styles from './SignupPage.module.css'

const PROGRAMS = [
  { code: 'MS_DAE', label: 'MS Data Analytics Engineering' },
  { code: 'MS_DS',  label: 'MS Data Science' },
  { code: 'MS_CS',  label: 'MS Computer Science' },
  { code: 'MS_DA',  label: 'MS Data Analytics' },
  { code: 'MS_IS',  label: 'MS Information Systems' },
]

const CAREERS = [
  'Data Engineer',
  'Data Scientist',
  'ML Engineer',
  'Data Analyst',
]

const GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C']

export default function SignupPage() {
  const { signup }  = useAuth()
  const navigate    = useNavigate()
  const searchRef   = useRef(null)

  const [form, setForm] = useState({
    name: '', email: '', password: '',
    program_code: '', target_career: '',
  })
  const [allCourses, setAllCourses]         = useState([])
  const [selectedCourses, setSelectedCourses] = useState([])
  const [search, setSearch]                 = useState('')
  const [showDropdown, setShowDropdown]     = useState(false)
  const [error, setError]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [coursesLoading, setCoursesLoading] = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  useEffect(() => {
    if (!form.program_code) return
    setCoursesLoading(true)
    coursesApi.list({ program: form.program_code })
      .then(r => setAllCourses(r.data))
      .catch(() => setAllCourses([]))
      .finally(() => setCoursesLoading(false))
  }, [form.program_code])

  const filteredCourses = allCourses.filter(c => {
    const q = search.toLowerCase()
    return (
      !selectedCourses.find(s => s.course_code === c.course_code) &&
      (c.course_code.toLowerCase().includes(q) || c.course_name.toLowerCase().includes(q))
    )
  })

  const addCourse = (course) => {
    setSelectedCourses(prev => [...prev, {
      course_code:  course.course_code,
      course_name:  course.course_name,
      credits:      course.credits,
      completed_at: '2025-05-15',
      grade:        'A',
    }])
    setSearch('')
  }

  const removeCourse = (code) => {
    setSelectedCourses(prev => prev.filter(c => c.course_code !== code))
  }

  const updateGrade = (code, grade) => {
    setSelectedCourses(prev => prev.map(c => c.course_code === code ? { ...c, grade } : c))
  }

  const submit = async e => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const payload = {
        ...form,
        completed_courses: selectedCourses.map(c => ({
          course_code:  c.course_code,
          completed_at: c.completed_at,
          grade:        c.grade,
        })),
      }
      await signup(payload)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <div className={styles.logoMark}>CW</div>
          <span className={styles.logoText}>Course<strong>Weave</strong> <span className={styles.ai}>AI</span></span>
        </div>
        <h1 className={styles.heroTitle}>Start your personalized<br />academic journey.</h1>
        <p className={styles.heroSub}>Tell us about your program and career goals. We'll build a course roadmap tailored just for you.</p>
        <div className={styles.steps}>
          {['Enter your details', 'Select your program & goal', 'Add completed courses', 'Get AI recommendations'].map((s, i) => (
            <div key={s} className={styles.step}>
              <div className={styles.stepNum}>{i + 1}</div>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Create your account</h2>
          <p className={styles.formSub}>All fields help us personalize your recommendations</p>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={submit} className={styles.form}>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>Full name <span className={styles.req}>*</span></label>
                <input name="name" placeholder="Aisha Patel" value={form.name} onChange={handle} required />
              </div>
              <div className={styles.field}>
                <label>NEU Email <span className={styles.req}>*</span></label>
                <input type="email" name="email" placeholder="you@northeastern.edu" value={form.email} onChange={handle} required />
              </div>
            </div>

            <div className={styles.field}>
              <label>Password <span className={styles.req}>*</span></label>
              <input type="password" name="password" placeholder="Min 8 characters" value={form.password} onChange={handle} required minLength={8} />
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>Graduate program <span className={styles.req}>*</span></label>
                <select name="program_code" value={form.program_code} onChange={handle} required>
                  <option value="">Select program…</option>
                  {PROGRAMS.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Career goal <span className={styles.req}>*</span></label>
                <select name="target_career" value={form.target_career} onChange={handle} required>
                  <option value="">Select target role…</option>
                  {CAREERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label>
                Courses already completed
                <span className={styles.optional}> — optional, helps personalize recommendations</span>
              </label>

              <div className={styles.courseSearchWrap} ref={searchRef}>
                <input
                  className={styles.courseSearch}
                  placeholder={
                    !form.program_code
                      ? 'Select a program first…'
                      : coursesLoading
                      ? 'Loading courses…'
                      : 'Search by code or name (e.g. IE6400, Machine Learning)…'
                  }
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  disabled={!form.program_code || coursesLoading}
                />
                {showDropdown && filteredCourses.length > 0 && (
                  <div className={styles.courseDropdown}>
                    {filteredCourses.slice(0, 8).map(c => (
                      <div key={c.course_code} className={styles.courseOption} onMouseDown={() => addCourse(c)}>
                        <span className={styles.optCode}>{c.course_code}</span>
                        <span className={styles.optName}>{c.course_name}</span>
                        <span className={styles.optCredits}>{c.credits}cr</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedCourses.length > 0 && (
                <div className={styles.selectedList}>
                  {selectedCourses.map(c => (
                    <div key={c.course_code} className={styles.selectedRow}>
                      <span className={styles.selCode}>{c.course_code}</span>
                      <span className={styles.selName}>{c.course_name}</span>
                      <select
                        className={styles.gradeSelect}
                        value={c.grade}
                        onChange={e => updateGrade(c.course_code, e.target.value)}
                      >
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <button type="button" className={styles.removeBtn} onClick={() => removeCourse(c.course_code)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner} /> : 'Create account & get recommendations →'}
            </button>
          </form>

          <p className={styles.switchLink}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
