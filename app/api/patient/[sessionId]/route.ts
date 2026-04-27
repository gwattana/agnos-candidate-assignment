import { getSession, updateSession } from '@/lib/store'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const session = await getSession(sessionId)
  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }
  return Response.json(session)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  let body: { data?: Record<string, string>; activeField?: string | null; submit?: boolean }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  await updateSession(sessionId, {
    data: body.data,
    activeField: body.activeField,
    rawStatus: body.submit ? 'submitted' : undefined,
  })

  return Response.json({ ok: true })
}
