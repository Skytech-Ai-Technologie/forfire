import type { UserRole } from '../types/database.ts'

/** UI hints only. The database policies are the access control. */

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role === 'teacher' || role === 'admin'
}

export function homeForRole(role: UserRole): string {
  return role === 'student' ? '/student' : '/teacher'
}

export function safeNext(value: string | null, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  return value
}
