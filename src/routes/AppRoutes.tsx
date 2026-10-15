import { Navigate, Route, Routes } from 'react-router-dom'
import { AssignmentDetailPage } from '../features/assignments/AssignmentDetailPage.tsx'
import { AssignmentEditorPage } from '../features/assignments/AssignmentEditorPage.tsx'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage.tsx'
import { SignInPage } from '../features/auth/SignInPage.tsx'
import { SignUpPage } from '../features/auth/SignUpPage.tsx'
import { UpdatePasswordPage } from '../features/auth/UpdatePasswordPage.tsx'
import { CourseDetailPage } from '../features/courses/CourseDetailPage.tsx'
import { CourseFormPage } from '../features/courses/CourseFormPage.tsx'
import { LandingPage } from '../features/landing/LandingPage.tsx'
import { ProfilePage } from '../features/profile/ProfilePage.tsx'
import { StudentDashboardPage } from '../features/student-dashboard/StudentDashboardPage.tsx'
import { MySubmissionsPage } from '../features/submissions/MySubmissionsPage.tsx'
import { ReviewPage } from '../features/submissions/ReviewPage.tsx'
import { AccessDeniedPage } from '../features/system/AccessDeniedPage.tsx'
import { NotFoundPage } from '../features/system/NotFoundPage.tsx'
import { TeacherDashboardPage } from '../features/teacher-dashboard/TeacherDashboardPage.tsx'
import { RecoveryGate, RequireRole } from './guards.tsx'

export function AppRoutes() {
  return (
    <RecoveryGate>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />
        <Route path="/profile" element={<RequireRole roles={['student', 'teacher', 'admin']}><ProfilePage /></RequireRole>} />
        <Route path="/student" element={<RequireRole roles={['student']}><StudentDashboardPage /></RequireRole>} />
        <Route path="/student/assignments/:assignmentId" element={<RequireRole roles={['student']}><AssignmentDetailPage /></RequireRole>} />
        <Route path="/student/submissions" element={<RequireRole roles={['student']}><MySubmissionsPage /></RequireRole>} />
        <Route path="/teacher" element={<RequireRole roles={['teacher', 'admin']}><TeacherDashboardPage /></RequireRole>} />
        <Route path="/teacher/courses/new" element={<RequireRole roles={['teacher', 'admin']}><CourseFormPage /></RequireRole>} />
        <Route path="/teacher/courses/:courseId" element={<RequireRole roles={['teacher', 'admin']}><CourseDetailPage /></RequireRole>} />
        <Route path="/teacher/courses/:courseId/assignments/new" element={<RequireRole roles={['teacher', 'admin']}><AssignmentEditorPage /></RequireRole>} />
        <Route path="/teacher/assignments/:assignmentId/edit" element={<RequireRole roles={['teacher', 'admin']}><AssignmentEditorPage /></RequireRole>} />
        <Route path="/teacher/assignments/:assignmentId/review" element={<RequireRole roles={['teacher', 'admin']}><ReviewPage /></RequireRole>} />
        <Route path="/student/profile" element={<Navigate to="/profile" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </RecoveryGate>
  )
}
