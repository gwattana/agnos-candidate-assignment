import { store } from '@/lib/store'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  let session = store.getSession(sessionId)
  if (!session) {
    session = store.createSession(sessionId)
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Send current state immediately
      send(session)

      // Send heartbeat every 20s so the connection stays alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'))
      }, 20_000)

      const unsubscribe = store.subscribe(sessionId, send)

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsubscribe()
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
