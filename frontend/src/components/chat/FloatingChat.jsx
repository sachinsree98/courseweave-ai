import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import styles from './FloatingChat.module.css'

const SUGGESTIONS = [
  'What courses should I take next?',
  'Am I on track to graduate?',
  'What are my prerequisite gaps?',
  'Best electives for my career?',
]

export default function FloatingChat() {
  const { student } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(1)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open && student && messages.length === 0) {
      setMessages([{ role: 'bot', text: `Hi ${student.name?.split(' ')[0]}! I'm your CourseWeave AI advisor. Ask me anything about your courses, prerequisites, or career path.` }])
    }
    if (open) { setUnread(0); setTimeout(() => inputRef.current?.focus(), 100) }
  }, [open])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setLoading(true)
    const loadId = Date.now()
    setMessages(prev => [...prev, { role: 'bot', text: '', loading: true, id: loadId }])
    try {
      const r = await api.post('/chat', { message: msg })
      setMessages(prev => prev.map(m => m.id === loadId ? { role: 'bot', text: r.data.reply } : m))
    } catch {
      setMessages(prev => prev.map(m => m.id === loadId ? { role: 'bot', text: 'Sorry, I had trouble connecting. Please try again.' } : m))
    } finally { setLoading(false) }
  }

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  if (!student) return null

  return (
    <>
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.aiAvatar}>AI</div>
              <div>
                <p className={styles.headerTitle}>CourseWeave Advisor</p>
                <p className={styles.headerSub}><span className={styles.onlineDot} />Online · {student.target_career} track</p>
              </div>
            </div>
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>x</button>
          </div>
          <div className={styles.messages}>
            {messages.map((m, i) => (
              <div key={i} className={`${styles.msgWrap} ${m.role === 'user' ? styles.userWrap : styles.botWrap}`}>
                {m.role === 'bot' && <div className={styles.botDot} />}
                <div className={`${styles.bubble} ${m.role === 'user' ? styles.userBubble : styles.botBubble}`}>
                  {m.loading ? <div className={styles.dots}><span /><span /><span /></div> : m.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {messages.length <= 1 && (
            <div className={styles.suggestions}>
              {SUGGESTIONS.map(s => <button key={s} className={styles.sugBtn} onClick={() => send(s)}>{s}</button>)}
            </div>
          )}
          <div className={styles.inputRow}>
            <input ref={inputRef} className={styles.input} placeholder="Ask about courses, prereqs, career..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} disabled={loading} />
            <button className={styles.sendBtn} onClick={() => send()} disabled={loading || !input.trim()}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8h12M9 3l5 5-5 5"/></svg>
            </button>
          </div>
        </div>
      )}
      <button className={`${styles.fab} ${open ? styles.fabOpen : ''}`} onClick={() => setOpen(o => !o)}>
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l12 12M16 4L4 16"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        )}
        {!open && unread > 0 && <span className={styles.badge}>{unread}</span>}
      </button>
    </>
  )
}
