import { Link } from 'react-router-dom'
import styles from './LandingPage.module.css'

const steps = [
  { num: '01', title: 'Tell us your goal', desc: 'Select your program and target career — Data Engineer, Data Scientist, ML Engineer, or Data Analyst.' },
  { num: '02', title: 'AI analyzes your profile', desc: 'Our RAG pipeline searches course catalogs, prerequisites, and real job market data from Adzuna.' },
  { num: '03', title: 'Get your roadmap', desc: 'Receive a personalized semester-by-semester course plan with prerequisites automatically validated.' },
]

const features = [
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
    title: 'RAG-powered recommendations',
    desc: 'Retrieval-Augmented Generation searches NEU course catalog, PDF syllabi, and program requirements to give accurate, grounded suggestions.',
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
    title: 'Prerequisite auto-validation',
    desc: 'Never get stuck. The system checks your completed courses against all prerequisites before recommending anything.',
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>,
    title: 'Degree audit & progress',
    desc: 'Track credits completed, core vs elective balance, GPA, and graduation timeline — all updated in real time.',
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    title: 'Natural language advisor',
    desc: 'Ask in plain English — "What should I take next semester for a data engineering career?" — and get actionable answers.',
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    title: 'Real job market data',
    desc: 'Recommendations are enriched with Adzuna job postings — courses are matched to actual skills employers are hiring for.',
  },
  {
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    title: '24/7 AI advisor access',
    desc: 'No more waiting for advisor appointments. Get instant, personalized guidance any time — day or night.',
  },
]

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <div className={styles.logoWrap}>
            <div className={styles.neuBadge}>
              <img
                src="/image.png"
                alt="Northeastern University"
                className={styles.neuLogoNav}
              />
            </div>
            <div className={styles.divider} />
            <img src="/logo_bg.png" alt="CourseWeave AI" className={styles.cwLogoImg} />
          </div>
        </div>
        <div className={styles.navRight}>
          <Link to="/login" className={styles.loginLink}>Sign in</Link>
          <Link to="/signup" className={styles.signupBtn}>Get started free</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTag}>
            <span className={styles.tagDot} />
            Northeastern University · For Graduate Students
          </div>
          <div className={styles.productName}>CourseWeave AI</div>
          <h1 className={styles.heroTitle}>
            Your academic path,<br />
            <span className={styles.heroAccent}>intelligently planned.</span>
          </h1>
          <p className={styles.heroDesc}>
            CourseWeave AI is an intelligent academic planning assistant that recommends
            personalized course paths based on your career goals — checking prerequisites,
            tracking your progress, and building a semester-by-semester roadmap.
            Powered by RAG and real job market data.
          </p>
          <div className={styles.heroActions}>
            <Link to="/signup" className={styles.primaryBtn}>
              Start planning for free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <Link to="/login" className={styles.secondaryBtn}>Sign in to dashboard</Link>
          </div>
          <div className={styles.stats}>
            {[
              { n: '500+', l: 'NEU courses indexed' },
              { n: 'RAG', l: 'Powered by Pinecone' },
              { n: 'Gemini', l: '2.5 Flash LLM' },
              { n: '24/7', l: 'AI advisor access' },
            ].map(s => (
              <div key={s.l} className={styles.stat}>
                <span className={styles.statN}>{s.n}</span>
                <span className={styles.statL}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>How it works</div>
          <h2 className={styles.sectionTitle}>From goal to graduation plan in minutes</h2>
          <div className={styles.steps}>
            {steps.map(s => (
              <div key={s.num} className={styles.step}>
                <div className={styles.stepNum}>{s.num}</div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} style={{ background: 'var(--bg-card)' }}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionTag}>Features</div>
          <h2 className={styles.sectionTitle}>Everything you need to plan your degree</h2>
          <div className={styles.features}>
            {features.map(f => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Ready to plan your academic journey?</h2>
          <p className={styles.ctaDesc}>Join Northeastern graduate students using AI to build smarter course plans aligned with their career goals.</p>
          <Link to="/signup" className={styles.ctaBtn}>
            Create your free account
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLeft}>
            <div className={styles.footerBrand}>
              <img src="/image.png" alt="Northeastern University" className={styles.footerNeuLogo} />
              <div>
                <p className={styles.footerName}>CourseWeave AI</p>
                <p className={styles.footerSub}>Powered by Northeastern University</p>
              </div>
            </div>
          </div>
          <div className={styles.footerRight}>
            <p>AI-powered academic planning for graduate students</p>
            <p>© 2026 CourseWeave AI · Northeastern University</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
