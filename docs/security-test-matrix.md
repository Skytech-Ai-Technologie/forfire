# Security test matrix

Direct checks live in `supabase/tests/rls.sql`. Run them with the Supabase CLI
(`supabase test db`) after the migration is applied to a local database.
The UI tests do not replace these. A passing screen can still hide a bad policy.

| Actor | Allowed | Must fail |
| --- | --- | --- |
| Student A | Own profile, own submissions, published or archived assignments for enrolled courses, own file download | Another student's profile or file, draft assignments, role change, setting another student ID, inserting a submission row, reading the submissions bucket without a matching row |
| Student B | The same, only for Student B | Student A's submission row, storage object, and feedback |
| Teacher of the course | Courses they teach, drafts, enrollment, review, private download, CSV of rows they can already see | Promoting themselves, reading a course they do not teach |
| Teacher outside the course | Their own courses only | This course's assignments, submissions, files, and enrollment requests |
| Signed-out visitor | Landing page and sign-in | Every table, every RPC, and every object in `submissions` |

Late work uses `submitted_at > due_at`. `submitted_at` is `now()` inside
`confirm_submission`. The browser clock is not stored.

Storage paths are `{course_id}/{assignment_id}/{student_id}/{submission_id}/{safe_filename}`.
The path is created by `begin_submission`. A policy allows the upload only when
that pending row belongs to `auth.uid()`. The folder name is not the permission.

HTML, Python, and notebooks can be submitted when the assignment allows them.
The app downloads those bytes. It does not render or execute them.
