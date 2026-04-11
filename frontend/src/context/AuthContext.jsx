import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [student, setStudent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cw_student')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('cw_token')
    if (token) {
      authApi.me()
        .then(r => {
          setStudent(r.data)
          localStorage.setItem('cw_student', JSON.stringify(r.data))
        })
        .catch(() => {
          localStorage.removeItem('cw_token')
          localStorage.removeItem('cw_student')
          setStudent(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const r = await authApi.login({ email, password })
    localStorage.setItem('cw_token', r.data.token)
    localStorage.setItem('cw_student', JSON.stringify(r.data))
    setStudent(r.data)
    return r.data
  }

  const signup = async (data) => {
    const r = await authApi.signup(data)
    localStorage.setItem('cw_token', r.data.token)
    localStorage.setItem('cw_student', JSON.stringify(r.data))
    setStudent(r.data)
    return r.data
  }

  const logout = () => {
    localStorage.removeItem('cw_token')
    localStorage.removeItem('cw_student')
    setStudent(null)
  }

  return (
    <AuthContext.Provider value={{ student, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
