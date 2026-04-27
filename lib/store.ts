import type { PatientData, SessionData, RawStatus } from './types'
import { EMPTY_PATIENT_DATA } from './types'

type Listener = (session: SessionData) => void

class SessionStore {
  private sessions = new Map<string, SessionData>()
  private listeners = new Map<string, Set<Listener>>()

  createSession(sessionId: string): SessionData {
    const session: SessionData = {
      sessionId,
      patientData: { ...EMPTY_PATIENT_DATA },
      rawStatus: 'not_started',
      activeField: null,
      lastActivity: Date.now(),
      createdAt: Date.now(),
    }
    this.sessions.set(sessionId, session)
    this.listeners.set(sessionId, new Set())
    return session
  }

  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId)
  }

  getAllSessions(): SessionData[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  updateSession(
    sessionId: string,
    patch: {
      data?: Partial<PatientData>
      activeField?: string | null
      rawStatus?: RawStatus
    }
  ) {
    let session = this.sessions.get(sessionId)
    if (!session) {
      session = this.createSession(sessionId)
    }

    if (patch.data) {
      session.patientData = { ...session.patientData, ...patch.data }
    }
    if (patch.activeField !== undefined) {
      session.activeField = patch.activeField
    }

    session.lastActivity = Date.now()

    if (patch.rawStatus) {
      session.rawStatus = patch.rawStatus
      if (patch.rawStatus === 'submitted') {
        session.submittedAt = Date.now()
        session.activeField = null
      }
    } else if (session.rawStatus === 'not_started') {
      const hasData = Object.values(session.patientData).some((v) => v !== '')
      if (hasData) session.rawStatus = 'active'
    }

    this.notify(sessionId, session)
  }

  subscribe(sessionId: string, listener: Listener): () => void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set())
    }
    this.listeners.get(sessionId)!.add(listener)
    return () => {
      this.listeners.get(sessionId)?.delete(listener)
    }
  }

  private notify(sessionId: string, session: SessionData) {
    this.listeners.get(sessionId)?.forEach((fn) => fn(session))
  }
}

declare global {
  var __sessionStore: SessionStore | undefined
}

export const store: SessionStore = globalThis.__sessionStore ?? new SessionStore()
globalThis.__sessionStore = store
