-- Direct database checks for the security matrix.
-- Run with: supabase test db
-- These statements talk to Postgres. They do not click through the website.

begin;
select plan(18);

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'profiles'),
  'RLS is enabled on profiles'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'courses'),
  'RLS is enabled on courses'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'course_members'),
  'RLS is enabled on course_members'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'assignments'),
  'RLS is enabled on assignments'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'submissions'),
  'RLS is enabled on submissions'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'enrollment_requests'),
  'RLS is enabled on enrollment_requests'
);

select ok(
  not (select public from storage.buckets where id = 'submissions'),
  'submissions bucket is private'
);

select ok(
  not has_table_privilege('anon', 'public.submissions', 'select'),
  'anonymous visitors cannot select submissions'
);
select ok(
  not has_table_privilege('authenticated', 'public.submissions', 'insert'),
  'signed-in users cannot insert submission rows directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.course_members', 'insert'),
  'signed-in users cannot insert memberships directly'
);
select ok(
  not has_function_privilege('anon', 'public.begin_submission(uuid, text, bigint, text)', 'execute'),
  'anonymous visitors cannot begin a submission'
);
select ok(
  not has_function_privilege('anon', 'public.promote_user(uuid, text)', 'execute'),
  'anonymous visitors cannot promote users'
);
select ok(
  not has_function_privilege('authenticated', 'public.cleanup_stale_pending_submissions()', 'execute'),
  'students and teachers cannot run retention cleanup'
);

select is(private.sanitize_filename('../../Notes Final!.pdf'), 'Notes Final_.pdf', 'filenames lose their directories');
select throws_ok($$select private.sanitize_filename('..')$$, 'P0001', 'invalid filename', 'path segments are rejected');
select is(public.submission_is_late('2026-10-15 12:00:01+00', '2026-10-15 12:00:00+00'), true, 'a file after the deadline is late');
select is(public.submission_is_late('2026-10-15 12:00:00+00', '2026-10-15 12:00:00+00'), false, 'the exact deadline is on time');
select ok(private.mime_allowed('pdf', 'application/pdf'), 'pdf mime is accepted');
select ok(not private.mime_allowed('pdf', 'text/html'), 'html disguised as pdf is rejected');

select * from finish();
rollback;
