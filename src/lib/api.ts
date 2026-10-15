import JSZip from 'jszip'
import { exportFolderName, toCsv } from './csv.ts'
import { formatDeadline, isLateSubmission } from './deadlines.ts'
import { requireSupabase } from './supabase.ts'
import type {
  Assignment,
  AssignmentStatus,
  Course,
  EnrollmentRequest,
  Profile,
  Submission,
  UserRole,
} from '../types/database.ts'

export interface StudentAssignment extends Assignment {
  course_name: string
  course_code: string
  timezone: string
}

export interface SubmissionView extends Submission {
  assignment_title?: string
  course_name?: string
  timezone?: string
  due_at?: string
  student_name?: string
  student_code?: string | null
}

interface EmbeddedProfile {
  display_name: string
  student_id: string | null
  role?: UserRole
}

interface EmbeddedCourse {
  name: string
  course_code: string
  timezone: string
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function omit<T extends object, K extends keyof T>(value: T, keys: K[]): Omit<T, K> {
  const next = { ...value }
  for (const key of keys) delete next[key]
  return next
}

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const client = requireSupabase()
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Profile | null
}

export async function updateMyProfile(input: {
  id: string
  displayName: string
  studentId?: string
}): Promise<void> {
  const client = requireSupabase()
  const payload: { display_name: string; student_id?: string } = {
    display_name: input.displayName.trim(),
  }
  if (input.studentId) payload.student_id = input.studentId.trim()
  const { error } = await client.from('profiles').update(payload).eq('id', input.id)
  if (error) {
    if (error.code === '23505') throw new Error('That student ID is already in use.')
    throw new Error(error.message)
  }
}

export async function fetchStudentAssignments(userId: string): Promise<StudentAssignment[]> {
  const client = requireSupabase()
  const { data: memberships, error: memberError } = await client
    .from('course_members')
    .select('course_id')
    .eq('user_id', userId)
    .eq('membership_role', 'student')
  if (memberError) throw new Error(memberError.message)
  const courseIds = (memberships ?? []).map((row) => row.course_id as string)
  if (courseIds.length === 0) return []
  const { data, error } = await client
    .from('assignments')
    .select('*, courses(name, course_code, timezone)')
    .in('course_id', courseIds)
    .in('status', ['published', 'archived'])
    .order('due_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const course = one(row.courses as EmbeddedCourse | EmbeddedCourse[] | null)
    const assignment = omit(row, ['courses'])
    return {
      ...(assignment as Assignment),
      course_name: course?.name ?? 'Course',
      course_code: course?.course_code ?? '',
      timezone: course?.timezone ?? 'UTC',
    }
  })
}

export async function fetchAssignmentForStudent(assignmentId: string): Promise<StudentAssignment | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('assignments')
    .select('*, courses(name, course_code, timezone)')
    .eq('id', assignmentId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const course = one(data.courses as EmbeddedCourse | EmbeddedCourse[] | null)
  const assignment = omit(data, ['courses'])
  return {
    ...(assignment as Assignment),
    course_name: course?.name ?? 'Course',
    course_code: course?.course_code ?? '',
    timezone: course?.timezone ?? 'UTC',
  }
}

export async function fetchMySubmissions(userId: string, assignmentId?: string): Promise<SubmissionView[]> {
  const client = requireSupabase()
  let query = client
    .from('submissions')
    .select('*, assignments(title, due_at, courses(name, timezone))')
    .eq('student_id', userId)
    .order('created_at', { ascending: false })
  if (assignmentId) query = query.eq('assignment_id', assignmentId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapStudentSubmission)
}

export async function fetchCourses(): Promise<Course[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('courses').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Course[]
}

export async function fetchCourse(courseId: string): Promise<Course | null> {
  const client = requireSupabase()
  const { data, error } = await client.from('courses').select('*').eq('id', courseId).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Course | null
}

export async function createCourse(input: {
  name: string
  courseCode: string
  description: string
  timezone: string
}): Promise<string> {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw new Error(userError.message)
  if (!userData.user) throw new Error('Sign in again before creating a course.')
  const { data, error } = await client
    .from('courses')
    .insert({
      name: input.name.trim(),
      course_code: input.courseCode.trim(),
      description: input.description.trim() || null,
      timezone: input.timezone,
      created_by: userData.user.id,
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('That course code is already in use.')
    throw new Error(error.message)
  }
  return data.id as string
}

export async function updateCourse(
  courseId: string,
  input: { name: string; courseCode: string; description: string; timezone: string; archived: boolean },
): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('courses')
    .update({
      name: input.name.trim(),
      course_code: input.courseCode.trim(),
      description: input.description.trim() || null,
      timezone: input.timezone,
      archived_at: input.archived ? new Date().toISOString() : null,
    })
    .eq('id', courseId)
  if (error) {
    if (error.code === '23505') throw new Error('That course code is already in use.')
    throw new Error(error.message)
  }
}

export async function fetchCourseAssignments(courseId: string): Promise<Assignment[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('assignments')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Assignment[]
}

export async function fetchAssignment(assignmentId: string): Promise<Assignment | null> {
  const client = requireSupabase()
  const { data, error } = await client.from('assignments').select('*').eq('id', assignmentId).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Assignment | null
}

export async function saveAssignment(input: {
  id?: string
  courseId: string
  title: string
  instructions: string
  dueAt: string
  allowedExtensions: string[]
  maxFileSizeBytes: number
  allowResubmission: boolean
  status: AssignmentStatus
}): Promise<string> {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw new Error(userError.message)
  if (!userData.user) throw new Error('Sign in again before saving an assignment.')
  const payload = {
    course_id: input.courseId,
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    due_at: input.dueAt,
    allowed_extensions: input.allowedExtensions,
    max_file_size_bytes: input.maxFileSizeBytes,
    allow_resubmission: input.allowResubmission,
    status: input.status,
    created_by: userData.user.id,
  }
  if (input.id) {
    const updates = omit(payload, ['created_by'])
    const { error } = await client.from('assignments').update(updates).eq('id', input.id)
    if (error) throw new Error(error.message)
    return input.id
  }
  const { data, error } = await client.from('assignments').insert(payload).select('id').single()
  if (error) throw new Error(error.message)
  return data.id as string
}

export interface CourseMemberView {
  user_id: string
  membership_role: 'teacher' | 'student'
  display_name: string
  student_id: string | null
}

export async function fetchCourseMembers(courseId: string): Promise<CourseMemberView[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('course_members')
    .select('user_id, membership_role, profiles(display_name, student_id)')
    .eq('course_id', courseId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const profile = one(row.profiles as EmbeddedProfile | EmbeddedProfile[] | null)
    return {
      user_id: row.user_id as string,
      membership_role: row.membership_role as 'teacher' | 'student',
      display_name: profile?.display_name ?? 'Member',
      student_id: profile?.student_id ?? null,
    }
  })
}

export async function fetchPendingRequests(courseId: string): Promise<Array<EnrollmentRequest & { display_name: string; student_code: string | null }>> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('enrollment_requests')
    .select('*, profiles(display_name, student_id)')
    .eq('course_id', courseId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const profile = one(row.profiles as EmbeddedProfile | EmbeddedProfile[] | null)
    const request = omit(row, ['profiles'])
    return {
      ...(request as EnrollmentRequest),
      display_name: profile?.display_name ?? 'Student',
      student_code: profile?.student_id ?? null,
    }
  })
}

export async function requestEnrollment(courseCode: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('request_enrollment', { p_course_code: courseCode.trim() })
  if (error) throw new Error(error.message)
}

export async function decideEnrollment(requestId: string, approve: boolean): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('decide_enrollment', {
    p_request_id: requestId,
    p_approve: approve,
  })
  if (error) throw new Error(error.message)
}

export async function enrollByStudentId(courseId: string, studentId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('enroll_by_student_id', {
    p_course_id: courseId,
    p_student_id: studentId.trim(),
  })
  if (error) throw new Error(error.message)
}

export async function addCourseTeacher(courseId: string, email: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('add_course_teacher', {
    p_course_id: courseId,
    p_email: email.trim(),
  })
  if (error) throw new Error(error.message)
}

export async function fetchReviewRows(assignmentId: string): Promise<SubmissionView[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('submissions')
    .select('*, profiles(display_name, student_id), assignments(title, due_at, courses(name, timezone))')
    .eq('assignment_id', assignmentId)
    .in('status', ['submitted', 'reviewed'])
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const profile = one(row.profiles as EmbeddedProfile | EmbeddedProfile[] | null)
    const mapped = mapStudentSubmission(row)
    return {
      ...mapped,
      student_name: profile?.display_name ?? 'Student',
      student_code: profile?.student_id ?? null,
    }
  })
}

export async function reviewSubmission(submissionId: string, feedback: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('review_submission', {
    p_submission_id: submissionId,
    p_feedback: feedback,
  })
  if (error) throw new Error(error.message)
}

export async function downloadOwnFile(storagePath: string, filename: string): Promise<void> {
  const client = requireSupabase()
  const { data, error } = await client.storage.from('submissions').download(storagePath)
  if (error || !data) throw new Error(error?.message ?? 'The file could not be downloaded.')
  saveBlob(data, filename)
}

export function submissionsToCsv(rows: SubmissionView[], courseName: string, assignmentTitle: string): string {
  const header = [
    'Course',
    'Assignment',
    'Student ID',
    'Student name',
    'File name',
    'Size bytes',
    'Submitted at',
    'Deadline',
    'Course time zone',
    'Late',
    'Status',
    'Version',
    'Feedback',
  ]
  const body = rows.map((row) => {
    const late = row.submitted_at && row.due_at ? isLateSubmission(row.submitted_at, row.due_at) : false
    return [
      courseName,
      assignmentTitle,
      row.student_code ?? '',
      row.student_name ?? '',
      row.original_filename,
      String(row.size_bytes),
      row.submitted_at ?? '',
      row.due_at ?? '',
      row.timezone ?? '',
      late ? 'yes' : 'no',
      row.status,
      String(row.version_number),
      row.feedback ?? '',
    ]
  })
  return toCsv([header, ...body])
}

export async function downloadSubmissionsZip(rows: SubmissionView[], courseName: string, assignmentTitle: string): Promise<void> {
  const client = requireSupabase()
  const zip = new JSZip()
  const root = zip.folder('ForFire-Export')
  if (!root) throw new Error('Could not prepare the export.')
  const courseFolder = root.folder(exportFolderName(courseName, 'Course'))
  const assignmentFolder = courseFolder?.folder(exportFolderName(assignmentTitle, 'Assignment'))
  if (!assignmentFolder) throw new Error('Could not prepare the export.')
  for (const row of rows) {
    const { data, error } = await client.storage.from('submissions').download(row.storage_path)
    if (error || !data) throw new Error(error?.message ?? `Could not download ${row.original_filename}.`)
    const studentLabel = row.student_code || `Student_${row.student_id.slice(0, 8)}`
    const studentFolder = assignmentFolder.folder(exportFolderName(studentLabel, 'Student'))
    const safeFile = exportFolderName(row.original_filename, `submission-v${row.version_number}`)
    studentFolder?.file(`v${row.version_number}_${safeFile}`, data)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  saveBlob(blob, `${exportFolderName(courseName, 'Course')}-${exportFolderName(assignmentTitle, 'Assignment')}.zip`)
}

export async function fetchProfilesForAdmin(): Promise<Profile[]> {
  const client = requireSupabase()
  const { data, error } = await client.from('profiles').select('*').order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Profile[]
}

export async function promoteUser(userId: string, role: UserRole): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('promote_user', { p_user_id: userId, p_role: role })
  if (error) throw new Error(error.message)
}

function mapStudentSubmission(row: Record<string, unknown>): SubmissionView {
  const assignment = one(row.assignments as { title: string; due_at: string; courses: EmbeddedCourse | EmbeddedCourse[] | null } | Array<{ title: string; due_at: string; courses: EmbeddedCourse | EmbeddedCourse[] | null }> | null)
  const course = assignment ? one(assignment.courses) : null
  const submission = omit(row, ['assignments', 'profiles'])
  return {
    ...(submission as unknown as Submission),
    assignment_title: assignment?.title,
    due_at: assignment?.due_at,
    course_name: course?.name,
    timezone: course?.timezone ?? 'UTC',
  }
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function describeDeadline(iso: string, timeZone: string): string {
  return formatDeadline(iso, timeZone)
}
