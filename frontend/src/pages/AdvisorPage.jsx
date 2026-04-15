import { useState, useRef, useEffect, useCallback } from 'react'
import { recommendApi, conversationsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Badge } from '../components/ui'
import { Send, Bot, User, Sparkles, Plus, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import styles from './AdvisorPage.module.css'

const SUGGESTIONS = [
  'What courses should I take next semester?',
  'Which electives align with my career goal?',
  'Am I on track to graduate on time?',
  'What prerequisites do I still need?',
]

const DEGREE_PATHS = [
  { key: 'coursework', label: 'Coursework', desc: 'All electives' },
  { key: 'project',    label: 'Project',    desc: 'IE 7945 + fewer electives' },
  { key: 'thesis',     label: 'Thesis',     desc: 'Research + fewer electives' },
]

function formatDate(ts) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 86400000) return 'Today'
  if (diff < 172800000) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function Message({ msg, onSelectPath }) {
  const isBot = msg.role === 'bot'
  return (
    <div className={`${styles.msgWrap} ${isBot ? styles.botWrap : styles.userWrap}`}>
      <div className={styles.msgAvatar}>
        {isBot ? <Bot size={14} /> : <User size={14} />}
      </div>
      <div className={`${styles.bubble} ${isBot ? styles.botBubble : styles.userBubble}`}>
        {msg.loading ? (
          <div className={styles.typingDots}><span /><span /><span /></div>
        ) : (
          <>
            <div className={styles.bubbleText}>
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>

            {msg.action === 'ask_path' && onSelectPath && (
              <div className={styles.pathButtons}>
                {DEGREE_PATHS.map(({ key, label, desc }) => (
                  <button key={key} className={styles.pathBtn} onClick={() => onSelectPath(key, label)}>
                    <span className={styles.pathBtnLabel}>{label}</span>
                    <span className={styles.pathBtnDesc}>{desc}</span>
                  </button>
                ))}
              </div>
            )}

            {msg.courses?.length > 0 && (
              <div className={styles.courseCards}>
                {msg.courses.map((c, i) => (
                  <div key={i} className={styles.courseCard}>
                    <div className={styles.courseCardTop}>
                      <span className={styles.courseCode}>{c.course_code}</span>
                      {c.course_type && (
                        <Badge variant={c.course_type === 'Core' ? 'core' : 'elective'}>{c.course_type}</Badge>
                      )}
                    </div>
                    <p className={styles.courseCardName}>{c.course_name}</p>
                    {c.reason && <p className={styles.courseCardReason}>{c.reason}</p>}
                    {c.credits && <p className={styles.courseCardMeta}>{c.credits} credits</p>}
                  </div>
                ))}
              </div>
            )}

            {msg.source === 'fallback' && (
              <p className={styles.fallbackNote}>⚠ RAG pipeline unavailable — showing catalog-based recommendations</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function AdvisorPage() {
  const { student } = useAuth()

  const greeting = `Hi ${student?.name?.split(' ')[0] || 'there'}! I'm your CourseWeave AI Advisor. I can recommend courses based on your career goal (${student?.target_career || 'your program'}), check prerequisites, and help you plan your semester. What would you like to know?`

  const [conversations, setConversations]   = useState([])
  const [activeConvId, setActiveConvId]     = useState(null)
  const [messages, setMessages]             = useState([{ role: 'bot', text: greeting }])
  const [input, setInput]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [convLoading, setConvLoading]       = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load conversation list on mount, auto-open the most recent
  const refreshConversations = useCallback(async () => {
    try {
      const r = await conversationsApi.list()
      setConversations(r.data)
      return r.data
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    (async () => {
      setConvLoading(true)
      const convs = await refreshConversations()
      if (convs.length > 0) {
        await openConversation(convs[0].id)
      }
      setConvLoading(false)
    })()
  }, [])

  const openConversation = async (id) => {
    try {
      const r = await conversationsApi.get(id)
      const dbMessages = r.data.messages.map(m => ({
        role:    m.role === 'user' ? 'user' : 'bot',
        text:    m.text,
        courses: m.courses || [],
        action:  m.action,
        source:  'rag',
      }))
      setActiveConvId(id)
      setMessages(dbMessages.length > 0 ? dbMessages : [{ role: 'bot', text: greeting }])
    } catch {
      setMessages([{ role: 'bot', text: greeting }])
    }
  }

  const startNewChat = () => {
    setActiveConvId(null)
    setMessages([{ role: 'bot', text: greeting }])
  }

  const deleteConversation = async (e, id) => {
    e.stopPropagation()
    try {
      await conversationsApi.del(id)
      const updated = await refreshConversations()
      if (activeConvId === id) {
        if (updated.length > 0) {
          await openConversation(updated[0].id)
        } else {
          startNewChat()
        }
      }
    } catch {}
  }

  const sendMessage = async (text, degPath = null) => {
    const userText = text || input.trim()
    if (!userText || loading) return
    setInput('')

    setMessages(prev => [...prev, { role: 'user', text: userText }])
    const loadingId = Date.now()
    setMessages(prev => [...prev, { role: 'bot', text: '', loading: true, id: loadingId }])
    setLoading(true)

    try {
      const r = await recommendApi.get({
        career_goal:     student?.target_career,
        degree_path:     degPath,
        conversation_id: activeConvId,
        user_message:    userText,
      })
      const data = r.data

      if (data.recommendation !== undefined) {
        const action  = data.action
        const courses = action === 'recommend' ? (data.courses || []) : []

        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { role: 'bot', text: data.recommendation, courses, action, source: 'rag' }
            : m
        ))

        // Update active conversation and sidebar
        if (data.conversation_id) {
          setActiveConvId(data.conversation_id)
          refreshConversations()
        }
      } else {
        // Fallback shape
        const recs = data.recommendations || []
        const replyText = recs.length > 0
          ? `Based on your goal of becoming a ${student?.target_career}, here are some courses from your catalog:`
          : `I couldn't find specific matches right now. Try browsing the course catalog.`
        setMessages(prev => prev.map(m =>
          m.id === loadingId
            ? { role: 'bot', text: replyText, courses: recs, action: 'recommend', source: data.source }
            : m
        ))
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { role: 'bot', text: 'Sorry, I had trouble connecting to the recommendation service.' }
          : m
      ))
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPath = (pathKey, pathLabel) => {
    sendMessage(`I'd like the ${pathLabel} path`, pathKey)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className={styles.page}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <div className={styles.sidebar}>
        <button className={styles.newChatBtn} onClick={startNewChat}>
          <Plus size={15} /> New Chat
        </button>

        <div className={styles.convList}>
          {convLoading ? (
            <p className={styles.convEmpty}>Loading…</p>
          ) : conversations.length === 0 ? (
            <p className={styles.convEmpty}>No chats yet</p>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`${styles.convItem} ${activeConvId === conv.id ? styles.convItemActive : ''}`}
                onClick={() => openConversation(conv.id)}
              >
                <div className={styles.convMeta}>
                  <span className={styles.convTitle}>{conv.title}</span>
                  <span className={styles.convDate}>{formatDate(conv.updated_at)}</span>
                </div>
                <button
                  className={styles.convDelete}
                  onClick={(e) => deleteConversation(e, conv.id)}
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Chat area ───────────────────────────────────────────────── */}
      <div className={styles.chatWrapper}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              <Sparkles size={18} style={{ color: 'var(--accent)' }} />
              AI Advisor
            </h1>
            <p className={styles.sub}>Powered by RAG · Gemini 2.5 Flash · Pinecone hybrid search</p>
          </div>
        </div>

        <div className={styles.chatArea}>
          <div className={styles.messages}>
            {messages.map((msg, i) => (
              <Message
                key={i}
                msg={msg}
                onSelectPath={loading ? null : handleSelectPath}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {messages.length === 1 && messages[0].role === 'bot' && (
            <div className={styles.suggestions}>
              <p className={styles.sugLabel}>Try asking:</p>
              <div className={styles.sugGrid}>
                {SUGGESTIONS.map(s => (
                  <button key={s} className={styles.sugBtn} onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.inputRow}>
            <textarea
              className={styles.input}
              rows={1}
              placeholder="Ask about courses, prerequisites, your career path…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
            />
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
