import type { CandidateWithAnalysis } from "./db.js";
import {
  parseLocalizedSummary,
  type LocalizedSummary,
} from "./localizedSummary.js";
import type { ResumeExperience, ResumeProject } from "./services/ai.js";

export interface CandidateResponse {
  id: number;
  user_id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  pdf_url: string | null;
  skills: string[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  summary: LocalizedSummary | null;
  score: number | null;
  created_at: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isResumeExperience = (value: unknown): value is ResumeExperience =>
  isRecord(value) &&
  typeof value.title === "string" &&
  typeof value.company === "string" &&
  typeof value.duration === "string" &&
  typeof value.description === "string";

const isResumeProject = (value: unknown): value is ResumeProject =>
  isRecord(value) &&
  typeof value.name === "string" &&
  typeof value.description === "string" &&
  isStringArray(value.technologies);

const parseJsonArray = <Item>(
  value: string | null,
  isItem: (item: unknown) => item is Item,
): Item[] => {
  if (value === null) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isItem);
  } catch {
    return [];
  }
};

export const toCandidateResponse = (candidate: CandidateWithAnalysis): CandidateResponse => ({
  id: candidate.id,
  user_id: candidate.user_id,
  name: candidate.name,
  email: candidate.email,
  phone: candidate.phone,
  linkedin: candidate.linkedin,
  github: candidate.github,
  pdf_url: candidate.pdf_url,
  skills: parseJsonArray(candidate.skills, (item): item is string =>
    typeof item === "string",
  ),
  experience: parseJsonArray(candidate.experience, isResumeExperience),
  projects: parseJsonArray(candidate.projects, isResumeProject),
  summary: parseLocalizedSummary(candidate.summary),
  score: candidate.score,
  created_at: candidate.created_at,
});
