export interface CandidateExperience {
  title: string
  company: string
  duration: string
  description: string
}

export interface CandidateProject {
  name: string
  description: string
  technologies: string[]
}

export interface LocalizedSummary {
  en: string
  fr: string
  ar: string
}

export interface Candidate {
  id: number
  user_id: number | null
  name: string
  email: string | null
  phone: string | null
  linkedin: string | null
  github: string | null
  pdf_url: string | null
  skills: string[]
  experience: CandidateExperience[]
  projects: CandidateProject[]
  summary: LocalizedSummary | null
  score: number | null
  created_at: string
}

export interface DeleteCandidateResponse {
  message: string
}
