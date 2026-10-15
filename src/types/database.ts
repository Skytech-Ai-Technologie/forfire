export type UserRole = 'student' | 'teacher' | 'admin'
export type AssignmentStatus = 'draft' | 'published' | 'archived'
export type SubmissionStatus = 'pending' | 'submitted' | 'reviewed'
export type MembershipRole = 'teacher' | 'student'
export type EnrollmentStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  display_name: string
  student_id: string | null
  role: UserRole
  created_at: string
}

export interface Course {
  id: string
  name: string
  course_code: string
  description: string | null
  timezone: string
  created_by: string
  created_at: string
  archived_at: string | null
}

export interface Assignment {
  id: string
  course_id: string
  title: string
  instructions: string
  due_at: string
  allowed_extensions: string[]
  max_file_size_bytes: number
  allow_resubmission: boolean
  status: AssignmentStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface Submission {
  id: string
  assignment_id: string
  student_id: string
  storage_path: string
  original_filename: string
  mime_type: string
  size_bytes: number
  submitted_at: string | null
  status: SubmissionStatus
  feedback: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  version_number: number
  created_at: string
}

export interface EnrollmentRequest {
  id: string
  course_id: string
  user_id: string
  status: EnrollmentStatus
  created_at: string
  decided_at: string | null
  decided_by: string | null
}
