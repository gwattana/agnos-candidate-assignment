import { Redis } from '@upstash/redis'
import type { PatientData, SessionData, RawStatus } from './types'
import { EMPTY_PATIENT_DATA } from './types'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const key = (sessionId: string) => `session:${sessionId}`

export async function createSession(sessionId: string): Promise<SessionData> {
  const session: SessionData = {
    sessionId,
    patientData: { ...EMPTY_PATIENT_DATA },
    rawStatus: 'not_started',
    activeField: null,
    lastActivity: Date.now(),
    createdAt: Date.now(),
  }
  await redis.set(key(sessionId), session)
  await redis.sadd('sessions', sessionId)
  return session
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  return redis.get<SessionData>(key(sessionId))
}

export async function getAllSessions(): Promise<SessionData[]> {
  const ids = await redis.smembers('sessions')
  if (ids.length === 0) return []
  const sessions = await Promise.all(ids.map((id) => getSession(id)))
  return (sessions.filter(Boolean) as SessionData[])
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function updateSession(
  sessionId: string,
  patch: {
    data?: Partial<PatientData>
    activeField?: string | null
    rawStatus?: RawStatus
  }
): Promise<SessionData> {
  let session = await getSession(sessionId)
  if (!session) {
    session = await createSession(sessionId)
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

  await redis.set(key(sessionId), session)
  return session
}