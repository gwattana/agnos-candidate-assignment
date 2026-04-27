export interface PatientData {
  firstName: string
  middleName: string
  lastName: string
  dateOfBirth: string
  gender: string
  phoneNumber: string
  email: string
  address: string
  preferredLanguage: string
  nationality: string
  emergencyContactName: string
  emergencyContactRelationship: string
  religion: string
}

export type RawStatus = 'not_started' | 'active' | 'submitted'
export type PatientStatus = 'not_started' | 'active' | 'idle' | 'inactive' | 'submitted'

export interface SessionData {
  sessionId: string
  patientData: PatientData
  rawStatus: RawStatus
  activeField: string | null
  lastActivity: number
  createdAt: number
  submittedAt?: number
}

export function computeStatus(session: SessionData): PatientStatus {
  if (session.rawStatus === 'submitted') return 'submitted'
  if (session.rawStatus === 'not_started') return 'not_started'
  const elapsed = Date.now() - session.lastActivity
  if (elapsed < 30_000) return 'active'
  if (elapsed < 300_000) return 'idle'
  return 'inactive'
}

export const EMPTY_PATIENT_DATA: PatientData = {
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  phoneNumber: '',
  email: '',
  address: '',
  preferredLanguage: '',
  nationality: '',
  emergencyContactName: '',
  emergencyContactRelationship: '',
  religion: '',
}

export const FIELD_LABELS: Record<keyof PatientData, string> = {
  firstName: 'First Name',
  middleName: 'Middle Name',
  lastName: 'Last Name',
  dateOfBirth: 'Date of Birth',
  gender: 'Gender',
  phoneNumber: 'Phone Number',
  email: 'Email',
  address: 'Address',
  preferredLanguage: 'Preferred Language',
  nationality: 'Nationality',
  emergencyContactName: 'Emergency Contact Name',
  emergencyContactRelationship: 'Emergency Contact Relationship',
  religion: 'Religion',
}

export const REQUIRED_FIELDS: (keyof PatientData)[] = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'gender',
  'phoneNumber',
  'address',
  'preferredLanguage',
  'nationality',
]