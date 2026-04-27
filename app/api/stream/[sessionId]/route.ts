import { getSession, createSession } from '@/lib/store'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  let session = await getSession(sessionId)
  if (!session) {
    session = await createSession(sessionId)
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Send current state immediately
      send(session)
      let lastActivity = session!.lastActivity

      // Poll Redis every 300ms for updates
      const poll = setInterval(async () => {
        try {
          const updated = await getSession(sessionId)
          if (updated && updated.lastActivity !== lastActivity) {
            lastActivity = updated.lastActivity
            send(updated)
          }
        } catch { /* ignore transient errors */ }
      }, 300)

      // Heartbeat every 20s to keep connection alive through proxies
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'))
      }, 20_000)

      request.signal.addEventListener('abort', () => {
        clearInterval(poll)
        clearInterval(heartbeat)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}