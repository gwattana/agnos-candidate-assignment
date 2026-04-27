'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { SessionData } from '@/lib/types'
import { computeStatus } from '@/lib/types'
import { timeAgo } from '@/lib/utils'

function StatusBadge({ session }: { session: SessionData }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  const status = computeStatus(session)

  const configs = {
    submitted: { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', label: 'Submitted' },
    active: { dot: 'bg-blue-500 animate-pulse', text: 'text-blue-700', bg: 'bg-blue-50', label: 'Active' },
    idle: { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50', label: 'Idle' },
    inactive: { dot: 'bg-slate-300', text: 'text-slate-600', bg: 'bg-slate-50', label: 'Inactive' },
    not_started: { dot: 'bg-slate-300', text: 'text-slate-500', bg: 'bg-slate-50', label: 'Not started' },
  }

  const cfg = configs[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function SessionCard({ session }: { session: SessionData }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  const name = [session.patientData.firstName, session.patientData.lastName]
    .filter(Boolean)
    .join(' ')

  return (
    <Link
      href={`/staff/${session.sessionId}`}
      className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-slate-900 truncate">
              {name || <span className="text-slate-400 font-normal italic">No name yet</span>}
            </p>
            <StatusBadge session={session} />
          </div>
          <p className="text-xs text-slate-400">
            Session {session.sessionId.slice(0, 8)} · {timeAgo(session.lastActivity)}
          </p>
          {session.patientData.dateOfBirth && (
            <p className="text-xs text-slate-500 mt-1">
              DOB: {session.patientData.dateOfBirth}
              {session.patientData.gender && ` · ${session.patientData.gender}`}
            </p>
          )}
        </div>
        <svg
          className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-1"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

export default function StaffPage() {
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)

  useEffect(() => {
    const load = () =>
      fetch('/api/session')
        .then((r) => r.json())
        .then((data: SessionData[]) => {
          setSessions(data)
          setLoading(false)
        })
        .catch(() => setLoading(false))

    load()
    const id = setInterval(load, 3_000)
    return () => clearInterval(id)
  }, [])

  // Re-render every 5s to update "X ago" labels and status
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Staff View</h1>
              <p className="text-xs text-slate-400">Live patient check-ins</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading sessions…
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="font-medium text-slate-700 mb-1">No active sessions</h3>
            <p className="text-sm text-slate-400">Waiting for patients to check in…</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-500 mb-4">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              {' · '}
              <span className="text-slate-400">auto-refreshes every 3s</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sessions.map((s) => (
                <SessionCard key={s.sessionId} session={s} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}