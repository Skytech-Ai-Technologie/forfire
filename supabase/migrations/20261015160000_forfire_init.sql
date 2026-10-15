-- ForFire schema, row level security, and private storage.
-- Apply this file once in the Supabase SQL editor, or with `supabase db push`.
-- Student files are stored in the private `submissions` bucket, never in git.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  student_id text,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) between 2 and 80),
  constraint profiles_student_id_shape check (
    student_id is null or student_id ~ '^[A-Za-z0-9][A-Za-z0-9-]{1,31}$'
  )
);

create unique index profiles_student_id_key on public.profiles (student_id);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  course_code text not null,
  description text,
  timezone text not null default 'UTC',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint courses_name_length check (char_length(name) between 2 and 160),
  constraint courses_code_shape check (course_code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,31}$'),
  constraint courses_description_length check (description is null or char_length(description) <= 2000)
);

create unique index courses_course_code_lower_idx on public.courses (lower(course_code));

create table public.course_members (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  membership_role text not null check (membership_role in ('teacher', 'student')),
  created_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create index course_members_user_idx on public.course_members (user_id);

create table public.enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  unique (course_id, user_id)
);

create index enrollment_requests_course_status_idx on public.enrollment_requests (course_id, status);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  instructions text not null default '',
  due_at timestamptz not null,
  allowed_extensions text[] not null,
  max_file_size_bytes bigint not null default 20971520,
  allow_resubmission boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_title_length check (char_length(title) between 2 and 160),
  constraint assignments_instructions_length check (char_length(instructions) <= 10000),
  constraint assignments_size_limit check (max_file_size_bytes between 1 and 20971520)
);

create index assignments_course_status_idx on public.assignments (course_id, status);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  submitted_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'reviewed')),
  feedback text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  version_number integer not null default 1,
  created_at timestamptz not null default now(),
  constraint submissions_filename_safe check (
    original_filename <> ''
    and original_filename !~ '[\\/]'
    and char_length(original_filename) <= 120
  ),
  constraint submissions_path_shape check (
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/\\]+$'
  ),
  constraint submissions_size_positive check (size_bytes > 0),
  constraint submissions_version_positive check (version_number > 0),
  constraint submissions_feedback_length check (feedback is null or char_length(feedback) <= 5000),
  constraint submissions_timestamp_status check (
    (status = 'pending' and submitted_at is null)
    or (status in ('submitted', 'reviewed') and submitted_at is not null)
  )
);

create index submissions_student_idx on public.submissions (student_id);
create index submissions_assignment_idx on public.submissions (assignment_id, submitted_at desc);
create unique index submissions_one_pending_idx
  on public.submissions (assignment_id, student_id)
  where status = 'pending';

comment on table public.submissions is
  'Metadata only. File bytes live in the private submissions storage bucket.';

-- ---------------------------------------------------------------------------
-- Helpers. private is not exposed through the Data API.
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function private.is_course_teacher(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_course_id is not null and (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
    or exists (
      select 1 from public.course_members
      where course_id = p_course_id
        and user_id = auth.uid()
        and membership_role = 'teacher'
    )
  );
$$;

create or replace function private.sanitize_filename(raw text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  base text;
  cleaned text;
begin
  base := regexp_replace(coalesce(raw, ''), '^.*[/\\]', '');
  base := replace(base, chr(0), '');
  cleaned := regexp_replace(base, '[^A-Za-z0-9._ -]', '_', 'g');
  cleaned := regexp_replace(cleaned, '_+', '_', 'g');
  cleaned := regexp_replace(cleaned, '^[\s.]+|[\s.]+$', '', 'g');
  if cleaned = '' or cleaned in ('.', '..') then
    raise exception 'invalid filename';
  end if;
  if char_length(cleaned) > 120 then
    cleaned := regexp_replace(left(cleaned, 120), '[\s.]+$', '', 'g');
  end if;
  if cleaned = '' then
    raise exception 'invalid filename';
  end if;
  return cleaned;
end;
$$;

create or replace function private.mime_allowed(p_ext text, p_mime text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(p_ext, ''))
    when 'pdf' then lower(coalesce(p_mime, '')) = 'application/pdf'
    when 'docx' then lower(coalesce(p_mime, '')) = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    when 'zip' then lower(coalesce(p_mime, '')) in ('application/zip', 'application/x-zip-compressed')
    when 'txt' then lower(coalesce(p_mime, '')) = 'text/plain'
    when 'png' then lower(coalesce(p_mime, '')) = 'image/png'
    when 'jpg' then lower(coalesce(p_mime, '')) = 'image/jpeg'
    when 'jpeg' then lower(coalesce(p_mime, '')) = 'image/jpeg'
    when 'py' then lower(coalesce(p_mime, '')) in ('text/x-python', 'text/plain', 'text/x-python-script')
    when 'ipynb' then lower(coalesce(p_mime, '')) in ('application/json', 'application/x-ipynb+json')
    when 'csv' then lower(coalesce(p_mime, '')) in ('text/csv', 'text/plain', 'application/vnd.ms-excel')
    when 'html' then lower(coalesce(p_mime, '')) = 'text/html'
    else false
  end;
$$;

create or replace function public.submission_is_late(p_submitted timestamptz, p_due timestamptz)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_submitted is not null and p_due is not null and p_submitted > p_due;
$$;

create or replace function private.can_upload_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where s.storage_path = object_name
      and s.student_id = auth.uid()
      and s.status = 'pending'
      and a.status = 'published'
      and s.size_bytes <= a.max_file_size_bytes
  );
$$;

create or replace function private.can_read_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.submissions s
    where s.storage_path = object_name
      and s.student_id = auth.uid()
      and s.status in ('submitted', 'reviewed')
  )
  or exists (
    select 1
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where s.storage_path = object_name
      and s.status in ('submitted', 'reviewed')
      and private.is_course_teacher(a.course_id)
  );
$$;

create or replace function private.can_delete_pending_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.submissions s
    where s.storage_path = object_name
      and s.student_id = auth.uid()
      and s.status = 'pending'
  );
$$;

-- ---------------------------------------------------------------------------
-- Profile protection and signup
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Protected profile fields cannot be changed.';
  end if;
  if char_length(trim(new.display_name)) < 2 or char_length(new.display_name) > 80 then
    raise exception 'Display name must be 2 to 80 characters.';
  end if;
  new.display_name := trim(new.display_name);

  if new.role is distinct from old.role then
    if current_user not in ('postgres', 'supabase_admin') then
      raise exception 'role is protected';
    end if;
  end if;

  if new.student_id is distinct from old.student_id then
    if current_user in ('postgres', 'supabase_admin') then
      null;
    elsif auth.uid() = old.id and old.student_id is null and new.student_id is not null then
      new.student_id := trim(new.student_id);
    else
      raise exception 'student_id cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_protect_columns
before update on public.profiles
for each row execute function public.protect_profile_columns();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, 'student'), '@', 1),
    'Student'
  );
  if char_length(v_name) < 2 then
    v_name := v_name || ' user';
  end if;
  if char_length(v_name) > 80 then
    v_name := left(v_name, 80);
  end if;

  insert into public.profiles (id, display_name, role)
  values (new.id, v_name, 'student');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Course and assignment guards
-- ---------------------------------------------------------------------------

create or replace function public.guard_course_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.';
  end if;
  if tg_op = 'INSERT' then
    if private.current_role() not in ('teacher', 'admin') then
      raise exception 'Only a teacher can create a course.';
    end if;
    new.created_by := auth.uid();
    new.created_at := now();
    new.archived_at := null;
  elsif not private.is_course_teacher(old.id) then
    raise exception 'You cannot edit this course.';
  end if;

  new.name := trim(new.name);
  new.course_code := trim(new.course_code);
  if new.description is not null then
    new.description := nullif(trim(new.description), '');
  end if;

  begin
    perform now() at time zone new.timezone;
  exception
    when invalid_parameter_value then
      raise exception 'Choose a valid IANA time zone.';
  end;
  return new;
end;
$$;

create trigger courses_guard_write
before insert or update on public.courses
for each row execute function public.guard_course_write();

create or replace function public.add_course_creator_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.course_members (course_id, user_id, membership_role)
  values (new.id, new.created_by, 'teacher')
  on conflict (course_id, user_id) do nothing;
  return new;
end;
$$;

create trigger courses_add_creator
after insert on public.courses
for each row execute function public.add_course_creator_membership();

create or replace function public.guard_assignment_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ext text;
  allowed text[] := array['pdf','docx','zip','txt','png','jpg','jpeg','py','ipynb','csv','html'];
begin
  if auth.uid() is null then
    raise exception 'Sign in is required.';
  end if;
  if tg_op = 'INSERT' then
    if not private.is_course_teacher(new.course_id) then
      raise exception 'You cannot create assignments for this course.';
    end if;
    new.created_by := auth.uid();
    new.created_at := now();
  else
    if not private.is_course_teacher(old.course_id) then
      raise exception 'You cannot edit this assignment.';
    end if;
    if new.course_id is distinct from old.course_id then
      raise exception 'An assignment cannot be moved to another course.';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  new.title := trim(new.title);
  new.instructions := trim(new.instructions);
  new.updated_at := now();
  if new.max_file_size_bytes < 1 or new.max_file_size_bytes > 20971520 then
    raise exception 'Maximum file size must be between 1 byte and 20 MB.';
  end if;

  new.allowed_extensions := (
    select coalesce(array_agg(distinct lower(item)), '{}')
    from unnest(coalesce(new.allowed_extensions, '{}')) as item
  );
  if cardinality(new.allowed_extensions) = 0 then
    raise exception 'Choose at least one file extension.';
  end if;
  foreach ext in array new.allowed_extensions loop
    if not (ext = any (allowed)) then
      raise exception 'Unsupported extension: %', ext;
    end if;
  end loop;
  return new;
end;
$$;

create trigger assignments_guard_write
before insert or update on public.assignments
for each row execute function public.guard_assignment_write();

-- ---------------------------------------------------------------------------
-- Trusted submission and enrollment functions
-- ---------------------------------------------------------------------------

create or replace function public.begin_submission(
  p_assignment_id uuid,
  p_filename text,
  p_size_bytes bigint,
  p_mime_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_assignment public.assignments%rowtype;
  v_filename text;
  v_ext text;
  v_submission_id uuid := extensions.gen_random_uuid();
  v_version integer;
  v_path text;
  v_recent integer;
begin
  if v_uid is null then
    raise exception 'Sign in is required.';
  end if;

  select count(*) into v_recent
  from public.submissions
  where student_id = v_uid
    and created_at > now() - interval '1 minute';
  if v_recent >= 5 then
    raise exception 'Too many submission attempts. Wait a minute and try again.';
  end if;

  select * into v_assignment from public.assignments where id = p_assignment_id;
  if not found then
    raise exception 'Assignment not found.';
  end if;
  if v_assignment.status <> 'published' then
    raise exception 'This assignment is not open for submissions.';
  end if;
  if not exists (
    select 1 from public.course_members
    where course_id = v_assignment.course_id
      and user_id = v_uid
      and membership_role = 'student'
  ) then
    raise exception 'You are not enrolled in this course.';
  end if;
  if exists (
    select 1 from public.submissions
    where assignment_id = p_assignment_id
      and student_id = v_uid
      and status = 'pending'
  ) then
    raise exception 'A submission is already in progress. Cancel it before trying again.';
  end if;
  if not v_assignment.allow_resubmission and exists (
    select 1 from public.submissions
    where assignment_id = p_assignment_id
      and student_id = v_uid
      and status in ('submitted', 'reviewed')
  ) then
    raise exception 'Resubmission is not allowed for this assignment.';
  end if;
  if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > v_assignment.max_file_size_bytes then
    raise exception 'This file is empty or larger than the assignment limit.';
  end if;

  v_filename := private.sanitize_filename(p_filename);
  v_ext := lower(substring(v_filename from '\.([^.]+)$'));
  if v_ext is null or v_ext = lower(v_filename) or not (v_ext = any (v_assignment.allowed_extensions)) then
    raise exception 'This file type is not accepted for the assignment.';
  end if;
  if not private.mime_allowed(v_ext, p_mime_type) then
    raise exception 'This file type does not match an allowed format.';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.submissions
  where assignment_id = p_assignment_id
    and student_id = v_uid
    and status in ('submitted', 'reviewed');

  v_path := v_assignment.course_id::text || '/' || v_assignment.id::text || '/' || v_uid::text || '/' || v_submission_id::text || '/' || v_filename;

  insert into public.submissions (
    id, assignment_id, student_id, storage_path, original_filename,
    mime_type, size_bytes, submitted_at, status, version_number
  ) values (
    v_submission_id, p_assignment_id, v_uid, v_path, v_filename,
    p_mime_type, p_size_bytes, null, 'pending', v_version
  );

  return jsonb_build_object(
    'submission_id', v_submission_id,
    'storage_path', v_path,
    'version_number', v_version
  );
exception
  when unique_violation then
    raise exception 'A submission is already in progress. Cancel it before trying again.';
end;
$$;

create or replace function public.confirm_submission(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.submissions%rowtype;
  v_assignment public.assignments%rowtype;
  v_object_size bigint;
  v_object_mime text;
  v_ext text;
begin
  if v_uid is null then
    raise exception 'Sign in is required.';
  end if;

  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found or v_sub.student_id <> v_uid then
    raise exception 'You cannot confirm this submission.';
  end if;
  if v_sub.status <> 'pending' then
    raise exception 'This submission is already finished.';
  end if;

  select * into v_assignment from public.assignments where id = v_sub.assignment_id;
  if v_assignment.status <> 'published' then
    raise exception 'This assignment is not open for submissions.';
  end if;

  select nullif(o.metadata ->> 'size', '')::bigint, o.metadata ->> 'mimetype'
  into v_object_size, v_object_mime
  from storage.objects o
  where o.bucket_id = 'submissions' and o.name = v_sub.storage_path;

  if v_object_size is null then
    raise exception 'The uploaded file could not be verified. Try again.';
  end if;
  if v_object_size <> v_sub.size_bytes or v_object_size > v_assignment.max_file_size_bytes then
    raise exception 'The uploaded file failed the size check.';
  end if;

  v_ext := lower(substring(v_sub.original_filename from '\.([^.]+)$'));
  if not private.mime_allowed(v_ext, coalesce(v_object_mime, '')) then
    raise exception 'The uploaded file failed the type check.';
  end if;

  update public.submissions
  set status = 'submitted',
      submitted_at = now(),
      mime_type = coalesce(v_object_mime, mime_type)
  where id = p_submission_id
  returning * into v_sub;

  return jsonb_build_object(
    'submission_id', v_sub.id,
    'submitted_at', v_sub.submitted_at,
    'status', v_sub.status,
    'version_number', v_sub.version_number
  );
end;
$$;

create or replace function public.abort_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.submissions%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in is required.';
  end if;
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found or v_sub.student_id <> v_uid then
    raise exception 'You cannot cancel this submission.';
  end if;
  if v_sub.status <> 'pending' then
    raise exception 'This submission is already finished.';
  end if;

  delete from storage.objects
  where bucket_id = 'submissions' and name = v_sub.storage_path;
  delete from public.submissions where id = v_sub.id;
end;
$$;

create or replace function public.review_submission(p_submission_id uuid, p_feedback text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.submissions%rowtype;
  v_course_id uuid;
  v_feedback text;
begin
  if v_uid is null then
    raise exception 'Sign in is required.';
  end if;
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found.';
  end if;
  if v_sub.status = 'pending' or v_sub.submitted_at is null then
    raise exception 'This upload has not finished.';
  end if;
  select course_id into v_course_id from public.assignments where id = v_sub.assignment_id;
  if not private.is_course_teacher(v_course_id) then
    raise exception 'You cannot review submissions for this course.';
  end if;
  v_feedback := nullif(trim(coalesce(p_feedback, '')), '');
  if v_feedback is not null and char_length(v_feedback) > 5000 then
    raise exception 'Feedback must be 5000 characters or fewer.';
  end if;

  update public.submissions
  set feedback = v_feedback,
      reviewed_by = v_uid,
      reviewed_at = now(),
      status = 'reviewed'
  where id = p_submission_id
  returning * into v_sub;

  return jsonb_build_object('submission_id', v_sub.id, 'status', v_sub.status, 'reviewed_at', v_sub.reviewed_at);
end;
$$;

create or replace function public.request_enrollment(p_course_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course_id uuid;
  v_request_id uuid;
  v_recent integer;
begin
  if v_uid is null then
    raise exception 'Sign in is required.';
  end if;
  if private.current_role() <> 'student' then
    raise exception 'Only a student account can request enrollment.';
  end if;
  select count(*) into v_recent
  from public.enrollment_requests
  where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'Too many enrollment requests. Try again later.';
  end if;

  select id into v_course_id
  from public.courses
  where lower(course_code) = lower(trim(p_course_code))
    and archived_at is null;
  if v_course_id is null then
    raise exception 'Course code not found, or the course is archived.';
  end if;
  if exists (
    select 1 from public.course_members
    where course_id = v_course_id and user_id = v_uid
  ) then
    raise exception 'You are already enrolled in this course.';
  end if;

  insert into public.enrollment_requests (course_id, user_id, status)
  values (v_course_id, v_uid, 'pending')
  on conflict (course_id, user_id) do update
    set status = 'pending', created_at = now(), decided_at = null, decided_by = null
    where public.enrollment_requests.status = 'rejected'
  returning id into v_request_id;

  if v_request_id is null then
    raise exception 'You already have a pending request for this course.';
  end if;
  return v_request_id;
end;
$$;

create or replace function public.decide_enrollment(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.enrollment_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in is required.';
  end if;
  select * into v_request from public.enrollment_requests where id = p_request_id for update;
  if not found then
    raise exception 'Enrollment request not found.';
  end if;
  if not private.is_course_teacher(v_request.course_id) then
    raise exception 'You cannot manage enrollment for this course.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request has already been decided.';
  end if;

  if p_approve then
    insert into public.course_members (course_id, user_id, membership_role)
    values (v_request.course_id, v_request.user_id, 'student')
    on conflict (course_id, user_id) do nothing;
    update public.enrollment_requests
    set status = 'approved', decided_at = now(), decided_by = v_uid
    where id = p_request_id;
  else
    update public.enrollment_requests
    set status = 'rejected', decided_at = now(), decided_by = v_uid
    where id = p_request_id;
  end if;
end;
$$;

create or replace function public.enroll_by_student_id(p_course_id uuid, p_student_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_student uuid;
begin
  if v_uid is null then
    raise exception 'Sign in is required.';
  end if;
  if not private.is_course_teacher(p_course_id) then
    raise exception 'You cannot manage enrollment for this course.';
  end if;
  select id into v_student
  from public.profiles
  where student_id = trim(p_student_id) and role = 'student';
  if v_student is null then
    raise exception 'No student account uses that student ID.';
  end if;
  insert into public.course_members (course_id, user_id, membership_role)
  values (p_course_id, v_student, 'student')
  on conflict (course_id, user_id) do nothing;
end;
$$;

create or replace function public.add_course_teacher(p_course_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_teacher uuid;
begin
  if v_uid is null then
    raise exception 'Sign in is required.';
  end if;
  if not private.is_course_teacher(p_course_id) then
    raise exception 'You cannot add teachers to this course.';
  end if;
  select p.id into v_teacher
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
    and p.role in ('teacher', 'admin');
  if v_teacher is null then
    raise exception 'No teacher account uses that email. An admin must promote them first.';
  end if;
  insert into public.course_members (course_id, user_id, membership_role)
  values (p_course_id, v_teacher, 'teacher')
  on conflict (course_id, user_id) do update set membership_role = 'teacher';
end;
$$;

create or replace function public.promote_user(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_current text;
  v_admins integer;
begin
  if v_uid is null or private.current_role() <> 'admin' then
    raise exception 'Only an admin can change roles.';
  end if;
  if p_role not in ('student', 'teacher', 'admin') then
    raise exception 'Unknown role.';
  end if;
  select role into v_current from public.profiles where id = p_user_id;
  if v_current is null then
    raise exception 'That account does not exist.';
  end if;
  if v_current = 'admin' and p_role <> 'admin' then
    select count(*) into v_admins from public.profiles where role = 'admin';
    if v_admins <= 1 then
      raise exception 'Keep at least one admin.';
    end if;
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

create or replace function public.cleanup_stale_pending_submissions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is not null then
    raise exception 'Run cleanup from the SQL editor as the project owner.';
  end if;
  delete from storage.objects o
  using public.submissions s
  where s.status = 'pending'
    and s.created_at < now() - interval '24 hours'
    and o.bucket_id = 'submissions'
    and o.name = s.storage_path;
  delete from public.submissions
  where status = 'pending'
    and created_at < now() - interval '24 hours';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Direct writes to submissions and memberships stay closed.
-- ---------------------------------------------------------------------------

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.courses from public, anon, authenticated;
revoke all on table public.course_members from public, anon, authenticated;
revoke all on table public.enrollment_requests from public, anon, authenticated;
revoke all on table public.assignments from public, anon, authenticated;
revoke all on table public.submissions from public, anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.courses to authenticated;
grant select on public.course_members to authenticated;
grant select on public.enrollment_requests to authenticated;
grant select, insert, update on public.assignments to authenticated;
grant select on public.submissions to authenticated;

revoke all on function public.begin_submission(uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.confirm_submission(uuid) from public, anon, authenticated;
revoke all on function public.abort_submission(uuid) from public, anon, authenticated;
revoke all on function public.review_submission(uuid, text) from public, anon, authenticated;
revoke all on function public.request_enrollment(text) from public, anon, authenticated;
revoke all on function public.decide_enrollment(uuid, boolean) from public, anon, authenticated;
revoke all on function public.enroll_by_student_id(uuid, text) from public, anon, authenticated;
revoke all on function public.add_course_teacher(uuid, text) from public, anon, authenticated;
revoke all on function public.promote_user(uuid, text) from public, anon, authenticated;
revoke all on function public.cleanup_stale_pending_submissions() from public, anon, authenticated;
revoke all on function public.submission_is_late(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.protect_profile_columns() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.guard_course_write() from public, anon, authenticated;
revoke all on function public.add_course_creator_membership() from public, anon, authenticated;
revoke all on function public.guard_assignment_write() from public, anon, authenticated;

grant execute on function public.begin_submission(uuid, text, bigint, text) to authenticated;
grant execute on function public.confirm_submission(uuid) to authenticated;
grant execute on function public.abort_submission(uuid) to authenticated;
grant execute on function public.review_submission(uuid, text) to authenticated;
grant execute on function public.request_enrollment(text) to authenticated;
grant execute on function public.decide_enrollment(uuid, boolean) to authenticated;
grant execute on function public.enroll_by_student_id(uuid, text) to authenticated;
grant execute on function public.add_course_teacher(uuid, text) to authenticated;
grant execute on function public.promote_user(uuid, text) to authenticated;
grant execute on function public.submission_is_late(timestamptz, timestamptz) to authenticated;

grant usage on schema private to authenticated;
grant execute on function private.current_role() to authenticated;
grant execute on function private.is_course_teacher(uuid) to authenticated;
grant execute on function private.can_upload_object(text) to authenticated;
grant execute on function private.can_read_object(text) to authenticated;
grant execute on function private.can_delete_pending_object(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.courses enable row level security;
alter table public.courses force row level security;
alter table public.course_members enable row level security;
alter table public.course_members force row level security;
alter table public.enrollment_requests enable row level security;
alter table public.enrollment_requests force row level security;
alter table public.assignments enable row level security;
alter table public.assignments force row level security;
alter table public.submissions enable row level security;
alter table public.submissions force row level security;

create policy forfire_profiles_select
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or private.current_role() = 'admin'
  or exists (
    select 1
    from public.course_members mine
    join public.course_members theirs on theirs.course_id = mine.course_id
    where mine.user_id = (select auth.uid())
      and mine.membership_role = 'teacher'
      and theirs.user_id = profiles.id
  )
);

create policy forfire_profiles_update
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy forfire_courses_select
on public.courses for select to authenticated
using (
  private.is_course_teacher(id)
  or exists (
    select 1 from public.course_members m
    where m.course_id = courses.id and m.user_id = (select auth.uid())
  )
);

create policy forfire_courses_insert
on public.courses for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.current_role() in ('teacher', 'admin')
);

create policy forfire_courses_update
on public.courses for update to authenticated
using (private.is_course_teacher(id))
with check (private.is_course_teacher(id));

create policy forfire_members_select
on public.course_members for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_course_teacher(course_id)
);

create policy forfire_requests_select
on public.enrollment_requests for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_course_teacher(course_id)
);

create policy forfire_assignments_select
on public.assignments for select to authenticated
using (
  private.is_course_teacher(course_id)
  or (
    status in ('published', 'archived')
    and exists (
      select 1 from public.course_members m
      where m.course_id = assignments.course_id
        and m.user_id = (select auth.uid())
        and m.membership_role = 'student'
    )
  )
);

create policy forfire_assignments_insert
on public.assignments for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_course_teacher(course_id)
);

create policy forfire_assignments_update
on public.assignments for update to authenticated
using (private.is_course_teacher(course_id))
with check (private.is_course_teacher(course_id));

create policy forfire_submissions_select
on public.submissions for select to authenticated
using (
  student_id = (select auth.uid())
  or private.is_course_teacher((
    select a.course_id from public.assignments a where a.id = submissions.assignment_id
  ))
);

-- ---------------------------------------------------------------------------
-- Private bucket. Restrictive policies still apply if a broad policy is added later.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions',
  'submissions',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain',
    'image/png',
    'image/jpeg',
    'text/x-python',
    'text/x-python-script',
    'application/json',
    'application/x-ipynb+json',
    'text/csv',
    'application/vnd.ms-excel',
    'text/html'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy forfire_submissions_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'submissions'
  and private.can_upload_object(name)
);

create policy forfire_submissions_read
on storage.objects for select to authenticated
using (
  bucket_id = 'submissions'
  and private.can_read_object(name)
);

create policy forfire_submissions_delete_pending
on storage.objects for delete to authenticated
using (
  bucket_id = 'submissions'
  and private.can_delete_pending_object(name)
);

create policy forfire_submissions_restrict_select
on storage.objects as restrictive for select to anon, authenticated
using (
  bucket_id <> 'submissions' or private.can_read_object(name)
);

create policy forfire_submissions_restrict_insert
on storage.objects as restrictive for insert to anon, authenticated
with check (
  bucket_id <> 'submissions' or private.can_upload_object(name)
);

create policy forfire_submissions_restrict_update
on storage.objects as restrictive for update to anon, authenticated
using (bucket_id <> 'submissions')
with check (bucket_id <> 'submissions');

create policy forfire_submissions_restrict_delete
on storage.objects as restrictive for delete to anon, authenticated
using (
  bucket_id <> 'submissions' or private.can_delete_pending_object(name)
);
