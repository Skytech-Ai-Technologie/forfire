import { canonicalMime, validateChosenFile } from './validation.ts'
import { requireSupabase, supabasePublishableKey, supabaseUrl } from './supabase.ts'

interface BeginResult {
  submission_id: string
  storage_path: string
  version_number: number
}

export async function submitAssignmentFile(options: {
  assignmentId: string
  file: File
  allowedExtensions: string[]
  maxFileSizeBytes: number
  onProgress: (percent: number) => void
}): Promise<void> {
  const problem = validateChosenFile(options.file, {
    allowed_extensions: options.allowedExtensions,
    max_file_size_bytes: options.maxFileSizeBytes,
  })
  if (problem) throw new Error(problem)

  const client = requireSupabase()
  const { data: sessionData, error: sessionError } = await client.auth.getSession()
  if (sessionError) throw new Error(sessionError.message)
  const session = sessionData.session
  if (!session) throw new Error('Sign in again before uploading.')

  const mimeType = canonicalMime(options.file.name, options.file.type)
  const { data, error } = await client.rpc('begin_submission', {
    p_assignment_id: options.assignmentId,
    p_filename: options.file.name,
    p_size_bytes: options.file.size,
    p_mime_type: mimeType,
  })
  if (error) throw new Error(error.message)
  const begun = data as BeginResult
  if (!begun?.submission_id || !begun.storage_path) {
    throw new Error('The server did not accept this submission.')
  }

  try {
    await uploadWithProgress({
      storagePath: begun.storage_path,
      file: options.file,
      mimeType,
      accessToken: session.access_token,
      onProgress: options.onProgress,
    })
    const { error: confirmError } = await client.rpc('confirm_submission', {
      p_submission_id: begun.submission_id,
    })
    if (confirmError) throw new Error(confirmError.message)
  } catch (uploadError) {
    const { error: abortError } = await client.rpc('abort_submission', {
      p_submission_id: begun.submission_id,
    })
    if (abortError) {
      throw new Error(`${errorMessageText(uploadError)} Cleanup also failed: ${abortError.message}`)
    }
    throw uploadError
  }
}

export async function cancelPendingSubmission(submissionId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('abort_submission', { p_submission_id: submissionId })
  if (error) throw new Error(error.message)
}

async function uploadWithProgress(options: {
  storagePath: string
  file: File
  mimeType: string
  accessToken: string
  onProgress: (percent: number) => void
}): Promise<void> {
  const baseUrl = supabaseUrl.replace(/\/$/, '')
  if (!baseUrl) throw new Error('Supabase URL is missing.')
  const encodedPath = options.storagePath.split('/').map(encodeURIComponent).join('/')
  const endpoint = `${baseUrl}/storage/v1/object/submissions/${encodedPath}`

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', endpoint)
    xhr.setRequestHeader('Authorization', `Bearer ${options.accessToken}`)
    xhr.setRequestHeader('apikey', supabasePublishableKey)
    xhr.setRequestHeader('Content-Type', options.mimeType)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.setRequestHeader('cache-control', 'no-store')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress(100)
        resolve()
        return
      }
      reject(new Error(readStorageError(xhr.responseText) || `Upload failed (${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'))
    xhr.send(options.file)
  })
}

function readStorageError(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string }
    return parsed.message || parsed.error || null
  } catch {
    return null
  }
}

function errorMessageText(error: unknown): string {
  return error instanceof Error ? error.message : 'Upload failed.'
}
