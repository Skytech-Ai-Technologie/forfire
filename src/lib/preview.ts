import type { Assignment, Course, EnrollmentRequest, Profile } from '../types/database.ts'
import type { CourseMemberView, StudentAssignment, SubmissionView } from './api.ts'
import { supabase } from './supabase.ts'

export const publicPreview = supabase === null

export const previewBlocked =
  'This public website does not create accounts or store files. The pages below are a sample class you can look through.'

const now = Date.parse('2026-10-15T12:00:00.000Z')
const day = 24 * 60 * 60 * 1000

export const previewCourseId = 'preview-course'
export const previewEssayId = 'preview-essay'
export const previewLabId = 'preview-lab'

export const previewStudent: Profile = {
  id: 'preview-student',
  display_name: 'Amina Diallo',
  student_id: 'STU-2048',
  role: 'student',
  created_at: new Date(now - 30 * day).toISOString(),
}

export const previewTeacher: Profile = {
  id: 'preview-teacher',
  display_name: 'Prof. N. Okonkwo',
  student_id: null,
  role: 'teacher',
  created_at: new Date(now - 40 * day).toISOString(),
}

const course: Course = {
  id: previewCourseId,
  name: 'Introduction to Computing',
  course_code: 'CS101',
  description: 'A sample course on this public page. Nothing here is saved to an account.',
  timezone: 'Africa/Lagos',
  created_by: previewTeacher.id,
  created_at: new Date(now - 20 * day).toISOString(),
  archived_at: null,
}

const essay: Assignment = {
  id: previewEssayId,
  course_id: previewCourseId,
  title: 'Short essay on algorithms',
  instructions: 'Write one page about how you would explain an algorithm to a new student. This sample cannot be uploaded.',
  due_at: new Date(now + 10 * day).toISOString(),
  allowed_extensions: ['pdf', 'docx'],
  max_file_size_bytes: 20 * 1024 * 1024,
  allow_resubmission: true,
  status: 'published',
  created_by: previewTeacher.id,
  created_at: new Date(now - 5 * day).toISOString(),
  updated_at: new Date(now - 5 * day).toISOString(),
}

const lab: Assignment = {
  id: previewLabId,
  course_id: previewCourseId,
  title: 'Lab 1: Hello, data',
  instructions: 'The sample hand-in below is already marked. Downloads stay in your browser.',
  due_at: new Date(now - 2 * day).toISOString(),
  allowed_extensions: ['py', 'zip', 'pdf'],
  max_file_size_bytes: 20 * 1024 * 1024,
  allow_resubmission: false,
  status: 'published',
  created_by: previewTeacher.id,
  created_at: new Date(now - 12 * day).toISOString(),
  updated_at: new Date(now - 2 * day).toISOString(),
}

const assignments = [essay, lab]

function asStudentAssignment(assignment: Assignment): StudentAssignment {
  return {
    ...assignment,
    course_name: course.name,
    course_code: course.course_code,
    timezone: course.timezone,
  }
}

const labSubmission: SubmissionView = {
  id: 'preview-submission',
  assignment_id: previewLabId,
  student_id: previewStudent.id,
  storage_path: 'preview/lab1.py',
  original_filename: 'lab1.py',
  mime_type: 'text/x-python',
  size_bytes: 842,
  submitted_at: new Date(now - 3 * day).toISOString(),
  status: 'reviewed',
  feedback: 'Clear structure. Add a short comment above the loop next time.',
  reviewed_by: previewTeacher.id,
  reviewed_at: new Date(now - 1 * day).toISOString(),
  version_number: 1,
  created_at: new Date(now - 3 * day).toISOString(),
  assignment_title: lab.title,
  course_name: course.name,
  timezone: course.timezone,
  due_at: lab.due_at,
  student_name: previewStudent.display_name,
  student_code: previewStudent.student_id,
}

const members: CourseMemberView[] = [
  {
    user_id: previewTeacher.id,
    membership_role: 'teacher',
    display_name: previewTeacher.display_name,
    student_id: null,
  },
  {
    user_id: previewStudent.id,
    membership_role: 'student',
    display_name: previewStudent.display_name,
    student_id: previewStudent.student_id,
  },
]

const request: EnrollmentRequest & { display_name: string; student_code: string | null } = {
  id: 'preview-request',
  course_id: previewCourseId,
  user_id: 'preview-visitor',
  status: 'pending',
  created_at: new Date(now - day).toISOString(),
  decided_at: null,
  decided_by: null,
  display_name: 'Sam Adeyemi',
  student_code: 'STU-3102',
}

export function previewCourses(): Course[] {
  return [course]
}

export function previewCourse(courseId: string): Course | null {
  return courseId === course.id ? course : null
}

export function previewStudentAssignments(): StudentAssignment[] {
  return assignments.map(asStudentAssignment)
}

export function previewAssignmentForStudent(assignmentId: string): StudentAssignment | null {
  const assignment = assignments.find((item) => item.id === assignmentId)
  return assignment ? asStudentAssignment(assignment) : null
}

export function previewAssignment(assignmentId: string): Assignment | null {
  return assignments.find((item) => item.id === assignmentId) ?? null
}

export function previewCourseAssignments(courseId: string): Assignment[] {
  return assignments.filter((item) => item.course_id === courseId)
}

export function previewMySubmissions(userId: string, assignmentId?: string): SubmissionView[] {
  if (userId !== previewStudent.id) return []
  return [labSubmission].filter((item) => !assignmentId || item.assignment_id === assignmentId)
}

export function previewReviewRows(assignmentId: string): SubmissionView[] {
  return assignmentId === previewLabId ? [labSubmission] : []
}

export function previewMembers(courseId: string): CourseMemberView[] {
  return courseId === course.id ? members : []
}

export function previewRequests(
  courseId: string,
): Array<EnrollmentRequest & { display_name: string; student_code: string | null }> {
  return courseId === course.id ? [request] : []
}

export function downloadPreviewFile(filename: string): void {
  const blob = new Blob(
    ['ForFire public preview.\nThis file was created in your browser and is not stored on a server.\n'],
    { type: 'text/plain' },
  )
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'preview.txt'
  link.click()
  URL.revokeObjectURL(url)
}
