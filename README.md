# ForFire

ForFire is a homework platform for university courses. Students see the
assignments for classes they belong to, upload a file, and read private
feedback. Teachers publish assignments, enroll students, and review work.

The website is a static React app. GitHub Pages can host that website.
It cannot store accounts, grades, or uploaded files. Those live in Supabase,
behind Row Level Security and a private storage bucket.

## What is ready, and what is not

The screens, database migration, storage rules, tests, and GitHub Actions
workflow are in this repository.

These parts are not done until you configure them:

- A Supabase project with the migration applied.
- Your own `.env` file, which is never committed.
- A GitHub repository named `forfire`, with Pages turned on.
- The Actions workflow run, and a check of the live site.

Do not treat a URL as live until that workflow is green and you have opened
the site yourself. This copy was not verified against a deployed URL.

## Local development

You need Node.js 22 or newer and npm.

```bash
npm install
copy .env.example .env
```

Edit `.env` and paste your Supabase project URL and publishable key.
The key may be labeled "anon" on older projects. Leave the secret key out.

```bash
npm run dev
```

Open [http://localhost:5173/forfire/](http://localhost:5173/forfire/).
The `/forfire/` prefix matches the GitHub Pages project site. Routes look
like `http://localhost:5173/forfire/#/sign-in`.

## Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste `supabase/migrations/20261015160000_forfire_init.sql`, and run it.
3. Open **Storage** and confirm the `submissions` bucket exists and is private. Do not add a public policy.
4. Open **Authentication → URL configuration**.
   - Add `http://localhost:5173/forfire/` to **Redirect URLs**.
   - After Pages is deployed, add `https://YOUR_GITHUB_USERNAME.github.io/forfire/` as well.
   - Set **Site URL** to whichever of those you are using.
5. Under **Authentication → Providers**, keep email enabled. Students create their own accounts.
6. Under **Authentication → Rate Limits**, leave the built-in limits on. The database also refuses more than five submission attempts per minute and more than ten enrollment requests per hour.
7. Create your account in the app, then open `docs/provision-teacher.sql`, replace the sample email, and run it in the SQL editor. That account becomes the first admin. Sign out and back in.
8. In the app, change other people to teachers from the admin panel. A student has no control that does this.

Optional CLI path, after [installing the Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The SQL editor path above is enough if you do not want the CLI.

### Roles

| Role | How someone gets it |
| --- | --- |
| student | Every new account. |
| teacher | An admin changes the role, or the SQL script does. |
| admin | The SQL script for the first one. Later admins can appoint another admin. |

### Course time zones

Each course stores an IANA time zone such as `Africa/Lagos`. A deadline of
18:00 is 18:00 in that zone. The database stores the instant as `timestamptz`.
A submission is late when `submitted_at` is later than `due_at`. `submitted_at`
is set with `now()` inside `confirm_submission`, not from the browser.

### Files

Uploads go to a private bucket named `submissions`. The database chooses the
object path:

```text
{course_id}/{assignment_id}/{student_user_id}/{submission_id}/{safe_filename}
```

The browser cannot pick that folder. `begin_submission` checks enrollment,
the deadline rules, the extension, the MIME type, and the size. The storage
policy allows the upload only while that pending row belongs to the signed-in
student. `confirm_submission` checks the stored object before it records
success. If confirmation fails, `abort_submission` deletes the pending row
and the object.

The default limit is 20 MB. A teacher can set a lower limit per assignment,
not a higher one. Allowed types start as PDF, DOCX, ZIP, TXT, PNG, JPG, JPEG,
PY, IPYNB, CSV, and HTML. HTML and scripts are downloaded only. ForFire does
not render or run them.

Teachers can download one file, a CSV of the rows they can already see, or a
ZIP whose folders are names for humans. Those folder names are created at
download time. They are not the stored path and they are not a permission.

### Retention

Confirmed submissions stay until the assignment or account is removed.
Archiving an assignment closes new uploads and keeps the files.
Students cannot delete a confirmed submission.

Unfinished uploads older than 24 hours can be removed by the project owner
in the SQL editor:

```sql
select public.cleanup_stale_pending_submissions();
```

Deleting an assignment removes its database rows. Check the Storage page
afterwards and delete any leftover objects in `submissions`. The source
repository is not a file store, so there is nothing to clean up there.

There is no automatic virus scan. Validation covers size, extension, and
MIME type.

## GitHub repository and Pages

The site is a project site: `https://YOUR_GITHUB_USERNAME.github.io/forfire/`.
Replace `YOUR_GITHUB_USERNAME` with the account that owns the repository.
The GitHub CLI on this computer is logged in as `Skytech-Ai-Technologie`, so
that account's Pages address would be
`https://Skytech-Ai-Technologie.github.io/forfire/`.
That address is not live until the Actions workflow finishes successfully
and you open it yourself. Do not invent a different project name. The Vite
base path is `/forfire/`.

1. Create a GitHub account if you need one.
2. Create a repository named `forfire`.
3. Push this project to the `main` branch.
4. Open the repository **Settings → Pages**.
5. Under **Build and deployment**, set **Source** to **GitHub Actions** if the page asks you to choose a source.
6. Open **Settings → Actions → General**. Under **Workflow permissions**, allow GitHub Actions to create pull requests only if you want that; Pages needs the token permissions already declared in `.github/workflows/deploy.yml`: `contents: read`, `pages: write`, and `id-token: write`.
7. Open **Settings → Secrets and variables → Actions → Variables** and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   If your dashboard still shows an anon key, you can put that value in `VITE_SUPABASE_PUBLISHABLE_KEY`, or in a variable named `VITE_SUPABASE_ANON_KEY`. The workflow passes these into the build. GitHub does not expose repository variables to the build unless the workflow does that.
8. Do not add a service-role key, secret key, or database password as a `VITE_` variable. Those would be baked into the public website.
9. Open **Actions**, choose **Deploy GitHub Pages**, and run it. You can also push to `main`, which starts the same workflow. Wait until it finishes.
10. Open the Pages URL shown on the workflow run and in **Settings → Pages**.
11. Add that exact URL to Supabase **Authentication → URL configuration**, both as a redirect URL and, once you are using the hosted site, as the site URL.
12. On the hosted site, test sign-in, refresh a page such as `#/student/submissions`, upload, download, and a student opening a teacher page.

Hash routes (`#/student`, `#/teacher/...`) are there so a refresh asks GitHub
Pages for `/forfire/` instead of a file that does not exist.

## Commands

```bash
npm run dev          # local site at http://localhost:5173/forfire/
npm run lint
npm test             # unit tests
npm run build
npm run test:e2e     # requires the build, then Playwright
npm run preview      # serves dist at http://localhost:4173/forfire/
```

The database test file is `supabase/tests/rls.sql`. It runs with
`supabase test db` when the CLI and Docker are available. See
`docs/security-test-matrix.md` for who must be denied.

## Privacy boundary

A student can read their own profile and submissions, and the published or
archived assignments for courses where they are enrolled. A teacher can manage
courses where they are a teacher member. An admin can appoint roles and manage
courses. Everyone else, including a teacher of a different course and a
signed-out visitor, is rejected by Postgres even if they call the API directly.
