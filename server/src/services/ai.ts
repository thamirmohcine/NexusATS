import OpenAI from "openai";

import {
  type LocalizedSummary,
  normalizeLocalizedSummary,
} from "../localizedSummary.js";

export interface ResumeAnalysis {
  candidateName: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  skills: string[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  summary: LocalizedSummary;
  score: number;
}

export interface ResumeExperience {
  title: string;
  company: string;
  duration: string;
  description: string;
}

export interface ResumeProject {
  name: string;
  description: string;
  technologies: string[];
}

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const MOCK_WARNING_MESSAGE = "[AI Service] Using mock response";
const MOCK_SKILLS = ["TypeScript", "React", "Node.js", "Express", "SQL"];
const MOCK_SUMMARY: LocalizedSummary = {
  en: "Strong candidate with solid full-stack fundamentals and practical project experience.",
  fr: "Candidat solide avec de bonnes bases full-stack et une experience pratique de projets.",
  ar: "مرشح قوي يمتلك أساسيات متينة في التطوير الشامل وخبرة عملية في المشاريع.",
};
const MOCK_SCORE = 88;
const FALLBACK_SUMMARY: LocalizedSummary = {
  en: "Resume analysis could not be completed automatically. Please review the resume manually.",
  fr: "L'analyse automatique du CV n'a pas pu etre terminee. Veuillez examiner le CV manuellement.",
  ar: "تعذر إكمال تحليل السيرة الذاتية تلقائياً. يرجى مراجعة السيرة يدوياً.",
};

const fallbackAnalysis = (): ResumeAnalysis => ({
  candidateName: "Unknown Candidate",
  email: null,
  phone: null,
  linkedin: null,
  github: null,
  skills: [],
  experience: [],
  projects: [],
  summary: FALLBACK_SUMMARY,
  score: 1,
});

const mockAnalysis = (resumeText: string): ResumeAnalysis => {
  const candidateName =
    resumeText.trim().split(/\s+/).slice(0, 2).join(" ") || "Alex Johnson";

  console.warn(MOCK_WARNING_MESSAGE);

  return {
    candidateName,
    email: null,
    phone: null,
    linkedin: null,
    github: null,
    skills: MOCK_SKILLS,
    experience: [
      {
        title: "Full-Stack Developer",
        company: "Sample Company",
        duration: "2+ years",
        description:
          "Built practical full-stack applications using TypeScript, React, Node.js, Express, and SQL.",
      },
    ],
    projects: [
      {
        name: "AI Candidate Screener",
        description:
          "A resume screening dashboard that analyzes candidate profiles and stores structured results.",
        technologies: MOCK_SKILLS,
      },
    ],
    summary: MOCK_SUMMARY,
    score: MOCK_SCORE,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeText = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : fallback;
};

const normalizeNullableText = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const normalizeSkills = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((skill): skill is string => typeof skill === "string")
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0);
};

const normalizeScore = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.min(100, Math.max(1, Math.round(value)));
};

const normalizeExperience = (value: unknown): ResumeExperience[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((experience) => ({
      title: normalizeText(experience.title, "Unknown title"),
      company: normalizeText(experience.company, "Unknown company"),
      duration: normalizeText(experience.duration, "Unknown duration"),
      description: normalizeText(
        experience.description,
        "No description provided.",
      ),
    }));
};

const normalizeProjects = (value: unknown): ResumeProject[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((project) => ({
      name: normalizeText(project.name, "Untitled project"),
      description: normalizeText(
        project.description,
        "No description provided.",
      ),
      technologies: normalizeSkills(project.technologies),
    }));
};

export const parseResumeAnalysisContent = (content: string): ResumeAnalysis => {
  try {
    const parsedContent: unknown = JSON.parse(content);

    if (!isRecord(parsedContent)) {
      return fallbackAnalysis();
    }

    return {
      candidateName: normalizeText(
        parsedContent.candidateName,
        "Unknown Candidate",
      ),
      email: normalizeNullableText(parsedContent.email),
      phone: normalizeNullableText(parsedContent.phone),
      linkedin: normalizeNullableText(parsedContent.linkedin),
      github: normalizeNullableText(parsedContent.github),
      skills: normalizeSkills(parsedContent.skills),
      experience: normalizeExperience(parsedContent.experience),
      projects: normalizeProjects(parsedContent.projects),
      summary: normalizeLocalizedSummary(
        parsedContent.summary,
        FALLBACK_SUMMARY,
      ),
      score: normalizeScore(parsedContent.score),
    };
  } catch {
    return fallbackAnalysis();
  }
};

const createOpenAIClient = (): OpenAI | null => {
  if (!process.env.GROQ_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: GROQ_BASE_URL,
  });
};

export const analyzeResume = async (
  resumeText: string,
): Promise<ResumeAnalysis> => {
  const trimmedResumeText = resumeText.trim();

  if (trimmedResumeText.length === 0) {
    throw new Error("Resume text is required");
  }

  const openai = createOpenAIClient();

  if (openai === null) {
    return mockAnalysis(trimmedResumeText);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: GROQ_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You analyze resumes for software engineering roles. Respond only with strict JSON. Do not include markdown, comments, or extra text.",
        },
        {
          role: "user",
          content: `Analyze this resume text and return JSON with exactly these fields:
{
  "candidateName": "string",
  "email": "string or null",
  "phone": "string or null",
  "linkedin": "string or null",
  "github": "string or null",
  "skills": ["string"],
  "experience": [
    {
      "title": "string",
      "company": "string",
      "duration": "string",
      "description": "string"
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": ["string"]
    }
  ],
  "summary": {
    "en": "short 2-sentence English summary",
    "fr": "short 2-sentence French summary",
    "ar": "short 2-sentence Arabic summary"
  },
  "score": 1
}

Use null for missing contact links or contact fields. Return summary as a localized object with English, French, and Arabic strings. Keep every summary concise and useful. Score must be an integer from 1 to 100 rating relevance to software engineering.

Resume text:
${trimmedResumeText}`,
        },
      ],
    });

    const content = completion.choices[0]?.message.content;

    if (typeof content !== "string") {
      return fallbackAnalysis();
    }

    return parseResumeAnalysisContent(content);
  } catch {
    return mockAnalysis(trimmedResumeText);
  }
};
