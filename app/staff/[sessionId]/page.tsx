'use client'

import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { SessionData } from '@/lib/types'
import { computeStatus, FIELD_LABELS } from '@/lib/types'
import type { PatientData } from '@/lib/types'
import { timeAgo } from '@/lib/utils'

const FIELD_SECTIONS: { title: string; fields: (keyof PatientData)[] }[] = [
  {
    title: 'Personal Information',
    fields: ['firstName', 'middleName', 'lastName', 'dateOfBirth', 'gender'],
  },
  {
    title: 'Contact Information',
    fields: ['phoneNumber', 'email', 'address'],
  },
  {
    title: 'Additional Information',
    fields: ['preferredLanguage', 'nationality', 'religion'],
  },
  {
    title: 'Emergency Contact',
    fields: ['emergencyContactName', 'emergencyContactRelationship'],
  },
]

const OPTIONAL_FIELDS: (keyof PatientData)[] = [
  'middleName', 'email', 'emergencyContactName', 'emergencyContactRelationship', 'religion',
]

function StatusBanner({ session }: { session: SessionData }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  const status = computeStatus(session)

  const configs = {
    submitted: {
      bg: 'bg-green-50 border-green-200',
      dot: 'bg-green-500',
      text: 'text-green-800',
      label: 'Form Submitted',
      sub: session.submittedAt
        ? `Submitted at ${new Date(session.submittedAt).toLocaleTimeString()}`
        : 'Patient has completed and submitted the form',
    },
    active: {
      bg: 'bg-blue-50 border-blue-200',
      dot: 'bg-blue-500 animate-pulse',
      text: 'text-blue-800',
      label: 'Active — Patient is filling in the form',
      sub: session.activeField
        ? `Currently filling: ${FIELD_LABELS[session.activeField as keyof PatientData] ?? session.activeField}`
        : 'Patient is actively working on the form',
    },
    idle: {
      bg: 'bg-amber-50 border-amber-200',
      dot: 'bg-amber-400',
      text: 'text-amber-800',
      label: 'Idle',
      sub: 'Patient has not typed in the last 30 seconds',
    },
    inactive: {
      bg: 'bg-slate-50 border-slate-200',
      dot: 'bg-slate-300',
      text: 'text-slate-700',
      label: 'Inactive',
      sub: 'No activity for over 5 minutes',
    },
    not_started: {
      bg: 'bg-slate-50 border-slate-200',
      dot: 'bg-slate-300',
      text: 'text-slate-700',
      label: 'Waiting',
      sub: 'Patient has not started filling in the form',
    },
  }

  const cfg = configs[status]

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${cfg.bg}`}>
      <span className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <div>
        <p className={`font-semibold text-sm ${cfg.text}`}>{cfg.label}</p>
        <p className={`text-xs mt-0.5 ${cfg.text} opacity-80`}>{cfg.sub}</p>
      </div>
    </div>
  )
}

function FieldRow({
  field,
  value,
  isActive,
  optional,
}: {
  field: keyof PatientData
  value: string
  isActive: boolean
  optional: boolean
}) {
  const label = FIELD_LABELS[field]
  const empty = !value

  return (
    <div
      className={`flex items-start gap-3 py-3 px-4 transition-colors ${
        isActive ? 'bg-blue-50' : ''
      }`}
    >
      <div className="w-2 flex-shrink-0 pt-1">
        {isActive && <span className="block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs text-slate-400">{label}</span>
          {optional && (
            <span className="text-xs text-slate-300 italic">optional</span>
          )}
          {isActive && (
            <span className="text-xs text-blue-500 font-medium">typing…</span>
          )}
        </div>
        {empty ? (
          <span className="text-sm text-slate-300 italic">—</span>
        ) : (
          <span className="text-sm text-slate-900 font-medium break-words">{value}</span>
        )}
      </div>
      {!empty && !isActive && (
        <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )}
    </div>
  )
}

export default function StaffSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = use(params)
  const [session, setSession] = useState<SessionData | null>(null)
  const [connected, setConnected] = useState(false)
  const [, setTick] = useState(0)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout>

    const connect = () => {
      const es = new EventSource(`/api/stream/${sessionId}`)
      esRef.current = es

      es.onopen = () => setConnected(true)

      es.onmessage = (e) => {
        try {
          setSession(JSON.parse(e.data) as SessionData)
          setConnected(true)
        } catch { /* ignore malformed messages */ }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        retryTimeout = setTimeout(connect, 2_000)
      }
    }

    connect()

    return () => {
      clearTimeout(retryTimeout)
      esRef.current?.close()
    }
  }, [sessionId])

  // Re-render every 5s for time-based status transitions
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  const name = session
    ? [session.patientData.firstName, session.patientData.lastName].filter(Boolean).join(' ')
    : null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/staff" className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 truncate">
                {name || 'Patient Check-In'}
              </h1>
              <p className="text-xs text-slate-400">
                Session {sessionId.slice(0, 8)}
                {session && ` · ${timeAgo(session.lastActivity)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-slate-400">{connected ? 'Live' : 'Reconnecting…'}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {!session ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Connecting…
          </div>
        ) : (
          <>
            <StatusBanner session={session} />

            {FIELD_SECTIONS.map((section) => (
              <div key={section.title} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
                  <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {section.title}
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {section.fields.map((field) => (
                    <FieldRow
                      key={field}
                      field={field}
                      value={session.patientData[field]}
                      isActive={session.activeField === field}
                      optional={OPTIONAL_FIELDS.includes(field)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  )
}