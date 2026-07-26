export const API_BASE_URL = 'http://localhost:5000/api'

export const getAuthHeaders = (authToken: string): Record<string, string> => ({
  Authorization: `Bearer ${authToken}`,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getErrorMessage = async (
  response: Response,
  fallbackMessage: string,
): Promise<string> => {
  try {
    const responseBody: unknown = await response.json()

    if (isRecord(responseBody) && typeof responseBody.error === 'string') {
      return responseBody.error
    }
  } catch {
    return fallbackMessage
  }

  return fallbackMessage
}
