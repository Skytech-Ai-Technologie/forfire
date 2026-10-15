# ForFire product requirements

ForFire is a coursework site for a university course. A student signs in,
sees assignments for enrolled courses, uploads one file, and reads feedback
written for them. A teacher publishes the assignment, enrolls the class, and
reviews the files. An administrator appoints teachers. Nobody appoints
themselves.

## Hosting

The interface is a static site on GitHub Pages at
`https://<github-username>.github.io/forfire/`. Accounts, rows, and files
belong in Supabase. The git repository stores source code only.

## People

- A student views enrolled work, submits within the file rules, replaces a
  file only when the teacher allowed another version, and downloads their own
  file.
- A teacher manages their courses, assignments, enrollment, reviews, private
  downloads, and a CSV export.
- An admin is created by a SQL script run in the Supabase dashboard. Later
  admins can change roles inside the app.

## Assignment rules

An assignment has instructions, a deadline, a course time zone, accepted
extensions, a maximum size up to 20 MB, and a resubmission switch. Status is
draft, published, or archived. A late submission is one whose server timestamp
is after the deadline.

## Files

The stored path uses ids, not a folder the student typed. Downloads use the
signed-in user's token. A ZIP export may use readable course, assignment, and
student folders, and that structure exists only in the downloaded archive.

## Done when

The production build succeeds, GitHub Actions can publish `dist`, a refresh
of a hashed route stays in the app, two students can submit without seeing
each other's files, and the course teacher can review and download those
files. Direct requests that break those rules fail in Postgres.
