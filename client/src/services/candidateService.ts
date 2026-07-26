import type {
  Candidate,
  DeleteCandidateResponse,
} from '../types/candidate'
import { API_BASE_URL, getAuthHeaders, getErrorMessage } from './http'

const CANDIDATES_API_URL = `${API_BASE_URL}/candidates`

export async function fetchCandidates(authToken: string): Promise<Candidate[]> {
  const res = await fetch(CANDIDATES_API_URL, {
    headers: getAuthHeaders(authToken),
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to fetch candidates'))
  }

  return res.json()
}

export async function analyzeResume(
  resumeText: string,
  authToken: string,
): Promise<Candidate> {
  const res = await fetch(`${CANDIDATES_API_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(authToken),
    },
    body: JSON.stringify({ resumeText }),
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to analyze resume'))
  }

  return res.json()
}

export async function uploadPdfResume(
  file: File,
  authToken: string,
): Promise<Candidate> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${CANDIDATES_API_URL}/upload-pdf`, {
    method: 'POST',
    headers: getAuthHeaders(authToken),
    body: formData,
  })

  if (!res.ok) {
    throw new Error(
      await getErrorMessage(res, 'Failed to upload PDF resume'),
    )
  }

  return res.json()
}

export async function deleteCandidate(
  id: number,
  authToken: string,
): Promise<DeleteCandidateResponse> {
  const res = await fetch(`${CANDIDATES_API_URL}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(authToken),
  })

  if (!res.ok) {
    throw new Error(await getErrorMessage(res, 'Failed to delete candidate'))
  }

  return res.json()
}
