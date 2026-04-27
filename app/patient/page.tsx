'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { PatientData } from '@/lib/types'
import { EMPTY_PATIENT_DATA, REQUIRED_FIELDS } from '@/lib/types'

type FormErrors = Partial<Record<keyof PatientData, string>>

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other']
const LANGUAGE_OPTIONS = [
  'English', 'Thai', 'Mandarin', 'Spanish', 'French', 'Arabic',
  'Hindi', 'Portuguese', 'Russian', 'Japanese', 'Korean', 'Other',
]
const NATIONALITY_OPTIONS = [
  'Thai', 'American', 'British', 'Chinese', 'Japanese', 'Korean',
  'Indian', 'Australian', 'Canadian', 'French', 'German', 'Other',
]

function validateForm(data: PatientData): FormErrors {
  const errors: FormErrors = {}

  if (!data.firstName.trim()) errors.firstName = 'First name is required'
  if (!data.lastName.trim()) errors.lastName = 'Last name is required'
  if (!data.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required'
  } else {
    const dob = new Date(data.dateOfBirth)
    const now = new Date()
    if (isNaN(dob.getTime())) {
      errors.dateOfBirth = 'Invalid date'
    } else if (dob > now) {
      errors.dateOfBirth = 'Date of birth cannot be in the future'
    } else if (now.getFullYear() - dob.getFullYear() > 150) {
      errors.dateOfBirth = 'Please enter a valid date of birth'
    }
  }
  if (!data.gender) errors.gender = 'Gender is required'
  if (!data.phoneNumber.trim()) {
    errors.phoneNumber = 'Phone number is required'
  } else if (!/^\+?[\d\s\-().]{7,20}$/.test(data.phoneNumber.trim())) {
    errors.phoneNumber = 'Please enter a valid phone number'
  }
  if (data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = 'Please enter a valid email address'
  }
  if (!data.address.trim()) errors.address = 'Address is required'
  if (!data.preferredLanguage) errors.preferredLanguage = 'Preferred language is required'
  if (!data.nationality) errors.nationality = 'Nationality is required'
  if (data.emergencyContactName.trim() && !data.emergencyContactRelationship.trim()) {
    errors.emergencyContactRelationship = 'Relationship is required when contact name is provided'
  }

  return errors
}

function validateField(name: keyof PatientData, value: string, data: PatientData): string {
  const tempData = { ...data, [name]: value }
  const errors = validateForm(tempData)
  return errors[name] ?? ''
}

export default function PatientPage() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [formData, setFormData] = useState<PatientData>({ ...EMPTY_PATIENT_DATA })
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof PatientData, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const createSession = useCallback(async () => {
    if (sessionId) return
    try {
      const r = await fetch('/api/session', { method: 'POST' })
      const s = await r.json()
      setSessionId(s.sessionId)
      return s.sessionId as string
    } catch (err) {
      console.error('Failed to create session:', err)
    }
  }, [sessionId])

  // Heartbeat while form is open — keeps lastActivity fresh so status stays active
  useEffect(() => {
    if (!sessionId) return
    const id = setInterval(() => {
      fetch(`/api/patient/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: {}, activeField: null }),
      })
    }, 15_000)
    return () => clearInterval(id)
  }, [sessionId])

  const sendUpdate = useCallback(
    (data: PatientData, activeField: string | null, isSubmit = false) => {
      if (!sessionId) return
      fetch(`/api/patient/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, activeField, submit: isSubmit }),
      })
    },
    [sessionId]
  )

  const handleChange = async (name: keyof PatientData, value: string) => {
    const updated = { ...formData, [name]: value }
    setFormData(updated)

    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value, updated) }))
    }

    const sid = sessionId ?? await createSession()
    if (!sid) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetch(`/api/patient/${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updated, activeField: name }),
      })
    }, 300)
  }

  const handleFocus = useCallback((name: keyof PatientData) => {
    if (!sessionId) return
    fetch(`/api/patient/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {}, activeField: name }),
    })
  }, [sessionId])

  const handleBlur = useCallback((name: keyof PatientData) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validateField(name, formData[name], formData) }))
    if (!sessionId) return
    fetch(`/api/patient/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {}, activeField: null }),
    })
  }, [sessionId, formData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const allTouched = Object.fromEntries(
      Object.keys(formData).map((k) => [k, true])
    ) as Record<keyof PatientData, boolean>
    setTouched(allTouched)

    const validationErrors = validateForm(formData)
    setErrors(validationErrors)
    if (Object.values(validationErrors).some(Boolean)) return

    setIsSubmitting(true)
    await sendUpdate(formData, null, true)
    setSubmitted(true)
    setIsSubmitting(false)
  }

  const staffUrl =
    typeof window !== 'undefined' && sessionId
      ? `${window.location.origin}/staff/${sessionId}`
      : ''

  const handleCopy = () => {
    if (!staffUrl) return
    navigator.clipboard.writeText(staffUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const completedCount = REQUIRED_FIELDS.filter((f) => formData[f].trim() !== '').length
  const progress = Math.round((completedCount / REQUIRED_FIELDS.length) * 100)

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Form Submitted!</h2>
          <p className="text-slate-500 mt-2">
            Your information has been received. A staff member will be with you shortly.
          </p>
          <p className="text-sm text-slate-400 mt-4">Session: {sessionId?.slice(0, 8)}…</p>
          <Link
            href="/"
            className="inline-block mt-8 text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Patient Check-In</h1>
            {sessionId && (
              <p className="text-xs text-slate-400">Session: {sessionId.slice(0, 8)}…</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 mb-1">{progress}% complete</div>
            <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
          {/* Staff link */}
          {sessionId && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M14.828 14.828a4 4 0 015.656 0l4-4a4 4 0 01-5.656-5.656l-1.102 1.101" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-800">Staff monitoring link</p>
                <p className="text-xs text-blue-600 truncate">{staffUrl}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs border border-blue-300 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <a
                  href={staffUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Open
                </a>
              </div>
            </div>
          )}

          {/* Personal Information */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Personal Information
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <FormField
                  label="First Name"
                  required
                  error={touched.firstName ? errors.firstName : undefined}
                >
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    onFocus={() => handleFocus('firstName')}
                    onBlur={() => handleBlur('firstName')}
                    placeholder="Enter first name"
                    className={inputClass(touched.firstName && !!errors.firstName)}
                  />
                </FormField>
                <FormField
                  label="Middle Name"
                  error={touched.middleName ? errors.middleName : undefined}
                >
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => handleChange('middleName', e.target.value)}
                    onFocus={() => handleFocus('middleName')}
                    onBlur={() => handleBlur('middleName')}
                    placeholder="Optional"
                    className={inputClass(false)}
                  />
                </FormField>
              </div>
              <FormField
                label="Last Name"
                required
                error={touched.lastName ? errors.lastName : undefined}
              >
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  onFocus={() => handleFocus('lastName')}
                  onBlur={() => handleBlur('lastName')}
                  placeholder="Enter last name"
                  className={inputClass(touched.lastName && !!errors.lastName)}
                />
              </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <FormField
                  label="Date of Birth"
                  required
                  error={touched.dateOfBirth ? errors.dateOfBirth : undefined}
                >
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                    onFocus={() => handleFocus('dateOfBirth')}
                    onBlur={() => handleBlur('dateOfBirth')}
                    className={inputClass(touched.dateOfBirth && !!errors.dateOfBirth)}
                  />
                </FormField>
                <FormField
                  label="Gender"
                  required
                  error={touched.gender ? errors.gender : undefined}
                >
                  <select
                    value={formData.gender}
                    onChange={(e) => handleChange('gender', e.target.value)}
                    onFocus={() => handleFocus('gender')}
                    onBlur={() => handleBlur('gender')}
                    className={selectClass(touched.gender && !!errors.gender, !formData.gender)}
                  >
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </FormField>
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Contact Information
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              <FormField
                label="Phone Number"
                required
                error={touched.phoneNumber ? errors.phoneNumber : undefined}
              >
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handleChange('phoneNumber', e.target.value)}
                  onFocus={() => handleFocus('phoneNumber')}
                  onBlur={() => handleBlur('phoneNumber')}
                  placeholder="+66 81 234 5678"
                  className={inputClass(touched.phoneNumber && !!errors.phoneNumber)}
                />
              </FormField>
              <FormField
                label="Email"
                error={touched.email ? errors.email : undefined}
              >
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  onFocus={() => handleFocus('email')}
                  onBlur={() => handleBlur('email')}
                  placeholder="optional@email.com"
                  className={inputClass(touched.email && !!errors.email)}
                />
              </FormField>
              <FormField
                label="Address"
                required
                error={touched.address ? errors.address : undefined}
              >
                <textarea
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  onFocus={() => handleFocus('address')}
                  onBlur={() => handleBlur('address')}
                  placeholder="Street address, city, country"
                  rows={3}
                  className={`${inputClass(touched.address && !!errors.address)} resize-none`}
                />
              </FormField>
            </div>
          </section>

          {/* Additional Information */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Additional Information
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <FormField
                  label="Preferred Language"
                  required
                  error={touched.preferredLanguage ? errors.preferredLanguage : undefined}
                >
                  <select
                    value={formData.preferredLanguage}
                    onChange={(e) => handleChange('preferredLanguage', e.target.value)}
                    onFocus={() => handleFocus('preferredLanguage')}
                    onBlur={() => handleBlur('preferredLanguage')}
                    className={selectClass(touched.preferredLanguage && !!errors.preferredLanguage, !formData.preferredLanguage)}
                  >
                    <option value="">Select language</option>
                    {LANGUAGE_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </FormField>
                <FormField
                  label="Nationality"
                  required
                  error={touched.nationality ? errors.nationality : undefined}
                >
                  <select
                    value={formData.nationality}
                    onChange={(e) => handleChange('nationality', e.target.value)}
                    onFocus={() => handleFocus('nationality')}
                    onBlur={() => handleBlur('nationality')}
                    className={selectClass(touched.nationality && !!errors.nationality, !formData.nationality)}
                  >
                    <option value="">Select nationality</option>
                    {NATIONALITY_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Religion">
                <input
                  type="text"
                  value={formData.religion}
                  onChange={(e) => handleChange('religion', e.target.value)}
                  onFocus={() => handleFocus('religion')}
                  onBlur={() => handleBlur('religion')}
                  placeholder="Optional"
                  className={inputClass(false)}
                />
              </FormField>
            </div>
          </section>

          {/* Emergency Contact */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Emergency Contact <span className="text-slate-400 normal-case font-normal">(optional)</span>
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <FormField label="Contact Name">
                  <input
                    type="text"
                    value={formData.emergencyContactName}
                    onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                    onFocus={() => handleFocus('emergencyContactName')}
                    onBlur={() => handleBlur('emergencyContactName')}
                    placeholder="Full name"
                    className={inputClass(false)}
                  />
                </FormField>
                <FormField
                  label="Relationship"
                  error={touched.emergencyContactRelationship ? errors.emergencyContactRelationship : undefined}
                >
                  <input
                    type="text"
                    value={formData.emergencyContactRelationship}
                    onChange={(e) => handleChange('emergencyContactRelationship', e.target.value)}
                    onFocus={() => handleFocus('emergencyContactRelationship')}
                    onBlur={() => handleBlur('emergencyContactRelationship')}
                    placeholder="e.g. Spouse, Parent"
                    className={inputClass(touched.emergencyContactRelationship && !!errors.emergencyContactRelationship)}
                  />
                </FormField>
              </div>
            </div>
          </section>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !sessionId}
            className="w-full bg-blue-600 text-white font-semibold py-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base shadow-sm"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Information'}
          </button>

          <p className="text-center text-xs text-slate-400 pb-8">
            Fields marked with <span className="text-red-500">*</span> are required
          </p>
        </div>
      </form>
    </div>
  )
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="px-4 pt-3 pb-3">
      <label className="block text-xs font-medium text-slate-500 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

function inputClass(hasError: boolean | undefined) {
  return [
    'w-full text-sm text-slate-900 placeholder-slate-400 bg-transparent',
    'border-0 outline-none focus:ring-0 p-0',
    'focus:placeholder-slate-300 transition-colors',
    hasError ? 'text-red-700' : '',
  ].join(' ')
}

function selectClass(hasError: boolean | undefined, isEmpty: boolean) {
  return [
    'w-full text-sm bg-transparent border-0 outline-none focus:ring-0 p-0 -ml-0.5',
    hasError ? 'text-red-700' : isEmpty ? 'text-slate-400' : 'text-slate-900',
  ].join(' ')
}