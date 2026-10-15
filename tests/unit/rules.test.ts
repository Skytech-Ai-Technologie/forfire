import { describe, expect, it } from 'vitest'
import { escapeCell, exportFolderName, toCsv } from '../../src/lib/csv.ts'
import { isLateSubmission, zonedLocalToUtcIso } from '../../src/lib/deadlines.ts'
import { isStaffRole, safeNext } from '../../src/lib/permissions.ts'
import { canonicalMime, sanitizeFilename, validateChosenFile } from '../../src/lib/validation.ts'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

describe('filenames', () => {
  it('drops directory segments so a caller cannot choose a storage folder', () => {
    expect(sanitizeFilename('../../secret.pdf')).toBe('secret.pdf')
    expect(sanitizeFilename('..\\..\\notes.docx')).toBe('notes.docx')
    expect(sanitizeFilename('folder/homework.pdf')).toBe('homework.pdf')
  })

  it('replaces unsafe characters and rejects empty names', () => {
    expect(sanitizeFilename('bad name!.pdf')).toBe('bad name_.pdf')
    expect(sanitizeFilename('a!!b.pdf')).toBe('a_b.pdf')
    expect(() => sanitizeFilename('..')).toThrow(/invalid filename/)
    expect(() => sanitizeFilename('   ')).toThrow(/invalid filename/)
  })
})

describe('file rules', () => {
  const assignment = { allowed_extensions: ['pdf'], max_file_size_bytes: 1024 }

  it('rejects the wrong extension and an oversized file before upload', () => {
    expect(validateChosenFile({ name: 'notes.txt', size: 10 }, assignment)).toMatch(/not accepted/)
    expect(validateChosenFile({ name: 'notes.pdf', size: 2048 }, assignment)).toMatch(/larger/)
    expect(validateChosenFile({ name: 'notes.pdf', size: 100 }, assignment)).toBeNull()
  })

  it('uses a canonical type when the browser omits one', () => {
    expect(canonicalMime('lab.py', '')).toBe('text/x-python')
    expect(canonicalMime('sheet.csv', 'text/plain')).toBe('text/plain')
  })
})

describe('deadlines', () => {
  it('marks work late only after the deadline instant', () => {
    expect(isLateSubmission('2026-10-15T12:00:01.000Z', '2026-10-15T12:00:00.000Z')).toBe(true)
    expect(isLateSubmission('2026-10-15T12:00:00.000Z', '2026-10-15T12:00:00.000Z')).toBe(false)
    expect(isLateSubmission(null, '2026-10-15T12:00:00.000Z')).toBe(false)
  })

  it('reads a course-local time instead of the laptop zone', () => {
    expect(zonedLocalToUtcIso('2026-10-15T12:00', 'UTC')).toBe('2026-10-15T12:00:00.000Z')
    expect(zonedLocalToUtcIso('2026-10-15T12:00', 'Africa/Lagos')).toBe('2026-10-15T11:00:00.000Z')
    expect(zonedLocalToUtcIso('2026-10-15T12:00', 'America/New_York')).toBe('2026-10-15T16:00:00.000Z')
  })
})

describe('permissions and export', () => {
  it('sends each role to their own home and blocks open redirects', () => {
    expect(isStaffRole('teacher')).toBe(true)
    expect(isStaffRole('student')).toBe(false)
    expect(safeNext('/student/submissions', '/')).toBe('/student/submissions')
    expect(safeNext('//evil.example', '/')).toBe('/')
    expect(safeNext('https://evil.example', '/')).toBe('/')
  })

  it('builds a human download folder without treating it as an authorization path', () => {
    expect(exportFolderName('Course Name!', 'Course')).toBe('Course Name_')
    const csv = toCsv([
      ['Name', 'Note'],
      ['Ada', 'said "hello", then left'],
    ])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(escapeCell('said "hello"')).toBe('"said ""hello"""')
  })
})

describe('client secrets', () => {
  it('does not reference a service-role or secret key in the frontend', () => {
    const root = path.resolve(process.cwd(), 'src')
    const files = walk(root).filter((file) => !file.endsWith('.test.ts'))
    const forbidden = [/service_role/i, /sb_secret_/, /SUPABASE_SECRET/]
    const hits = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8')
      return forbidden.filter((pattern) => pattern.test(text)).map((pattern) => `${file} matches ${pattern}`)
    })
    expect(hits).toEqual([])
  })
})

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}
