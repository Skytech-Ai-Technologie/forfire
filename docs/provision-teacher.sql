-- Run this in the Supabase SQL Editor after the migration and after the
-- person has created an account in ForFire. Replace the email.
-- This is the trusted way to appoint the first admin. The app cannot do it,
-- and a student cannot call it on themselves.

update public.profiles
set role = 'admin'
where id = (
  select id
  from auth.users
  where lower(email) = lower('teacher@example.com')
);

-- Check the result, then sign out and back in.
-- select id, display_name, role from public.profiles where role = 'admin';
