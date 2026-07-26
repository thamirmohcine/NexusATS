import assert from "node:assert/strict";
import test from "node:test";

import type { Candidate } from "../src/db.js";
import { toCandidateResponse } from "../src/candidateResponse.js";

const rawCandidate: Candidate = {
  id: 1,
  user_id: null,
  name: "Maya Chen",
  email: "maya@example.com",
  phone: "+1 555 0100",
  linkedin: "https://linkedin.com/in/mayachen",
  github: "https://github.com/mayachen",
  pdf_url: "http://localhost:5000/uploads/maya-resume.pdf",
  skills: JSON.stringify(["TypeScript", "React"]),
  experience: JSON.stringify([
    {
      title: "Software Engineer",
      company: "Acme",
      duration: "2022-2026",
      description: "Built hiring tools.",
    },
  ]),
  projects: JSON.stringify([
    {
      name: "Candidate Screener",
      description: "Resume analysis dashboard.",
      technologies: ["React", "Express", "SQLite"],
    },
  ]),
  summary: JSON.stringify({
    en: "Full-stack engineer.",
    fr: "Ingenieure full-stack.",
    ar: "مهندسة شاملة.",
  }),
  score: 92,
  created_at: "2026-07-24 12:00:00",
};

test("toCandidateResponse parses rich JSON candidate fields", () => {
  const candidate = toCandidateResponse(rawCandidate);

  assert.deepEqual(candidate.skills, ["TypeScript", "React"]);
  assert.deepEqual(candidate.experience, [
    {
      title: "Software Engineer",
      company: "Acme",
      duration: "2022-2026",
      description: "Built hiring tools.",
    },
  ]);
  assert.deepEqual(candidate.projects, [
    {
      name: "Candidate Screener",
      description: "Resume analysis dashboard.",
      technologies: ["React", "Express", "SQLite"],
    },
  ]);
  assert.equal(candidate.phone, "+1 555 0100");
  assert.equal(candidate.linkedin, "https://linkedin.com/in/mayachen");
  assert.equal(candidate.github, "https://github.com/mayachen");
  assert.equal(candidate.pdf_url, "http://localhost:5000/uploads/maya-resume.pdf");
  assert.deepEqual(candidate.summary, {
    en: "Full-stack engineer.",
    fr: "Ingenieure full-stack.",
    ar: "مهندسة شاملة.",
  });
});

test("toCandidateResponse converts legacy string summaries into localized summaries", () => {
  const candidate = toCandidateResponse({
    ...rawCandidate,
    summary: "Legacy summary.",
  });

  assert.deepEqual(candidate.summary, {
    en: "Legacy summary.",
    fr: "Legacy summary.",
    ar: "Legacy summary.",
  });
});
