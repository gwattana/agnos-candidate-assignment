import { createSession, getAllSessions } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sessions = await getAllSessions()
  return Response.json(sessions)
}

export async function POST() {
  const sessionId = crypto.randomUUID()
  const session = await createSession(sessionId)
  return Response.json(session, { status: 201 })
}