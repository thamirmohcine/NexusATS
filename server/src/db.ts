export type CandidateSkillsJson = string;
export type CandidateExperienceJson = string;
export type CandidateProjectsJson = string;
export type UserRole = "candidate" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  created_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  refresh_token_hash: string;
  expires_at: string;
  revoked: 0 | 1;
  created_at: string;
}

export interface CreateSessionInput {
  user_id: number;
  refresh_token_hash: string;
  expires_at: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface Candidate {
  id: number;
  user_id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  created_at: string;
}

export interface CreateCandidateInput {
  user_id?: number | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  github?: string | null;
}

export interface Resume {
  id: number;
  candidate_id: number;
  pdf_url: string | null;
  uploaded_at: string;
}

export interface CreateResumeInput {
  candidate_id: number;
  pdf_url: string | null;
}

export interface ResumeAnalysis {
  id: number;
  resume_id: number;
  skills: string | null;
  experience: string | null;
  projects: string | null;
  summary: string | null;
  score: number | null;
  created_at: string;
}

export interface CreateResumeAnalysisInput {
  resume_id: number;
  skills: string | null;
  experience: string | null;
  projects: string | null;
  summary: string | null;
  score: number | null;
}

/** Join result of candidates + latest resume + latest analysis */
export interface CandidateWithAnalysis extends Candidate {
  pdf_url: string | null;
  skills: string | null;
  experience: string | null;
  projects: string | null;
  summary: string | null;
  score: number | null;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  candidate_id: number;
  content: string;
  is_read: 0 | 1;
  created_at: string;
}

export interface CreateMessageInput {
  sender_id: number;
  receiver_id: number;
  candidate_id: number;
  content: string;
}

export interface Notification {
  id: number;
  user_id: number | null;
  target_role: UserRole | null;
  candidate_id: number | null;
  sender_id: number | null;
  type: string;
  title: string;
  content: string;
  is_read: 0 | 1;
  created_at: string;
}

export interface CreateNotificationInput {
  user_id?: number | null;
  target_role?: UserRole | null;
  candidate_id?: number | null;
  sender_id?: number | null;
  type: string;
  title: string;
  content: string;
}

export { databasePath, db } from "./config/db.js";
export { db as default } from "./config/db.js";
