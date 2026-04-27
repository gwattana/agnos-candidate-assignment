import { store } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sessions = store.getAllSessions()
  return Response.json(sessions)
}

export async function POST() {
  const sessionId = crypto.randomUUID()
  const session = store.createSession(sessionId)
  return Response.json(session, { status: 201 })
}