import assert from "node:assert/strict";
import test from "node:test";

import type { Candidate } from "../src/types/candidate";
import {
  buildCandidatesCsv,
  candidateMatchesSearch,
  getCandidatePdfUrl,
  getLocalizedSummary,
  getProfileUrl,
  getScoreTone,
  sortCandidates,
  type CandidateSortOption,
} from "../src/candidateUtils";

const candidate: Candidate = {
  id: 1,
  user_id: 1,
  name: "Maya Chen",
  email: "maya@example.com",
  phone: "+1 555 0100",
  linkedin: "https://linkedin.com/in/mayachen",
  github: "https://github.com/mayachen",
  pdf_url: null,
  skills: ["TypeScript", "Node.js", "SQLite"],
  experience: [],
  projects: [],
  summary: {
    en: "Full-stack engineer with strong API experience.",
    fr: "Ingenieure full-stack avec une solide experience API.",
    ar: "مهندسة شاملة بخبرة قوية في واجهات البرمجة.",
  },
  score: 86,
  created_at: "2026-07-24T09:30:00.000Z",
};

test("getScoreTone returns green, yellow, or red by score threshold", () => {
  assert.equal(getScoreTone(80), "green");
  assert.equal(getScoreTone(79), "yellow");
  assert.equal(getScoreTone(60), "yellow");
  assert.equal(getScoreTone(59), "red");
});

test("candidateMatchesSearch filters candidates by name or skill", () => {
  assert.equal(candidateMatchesSearch(candidate, "maya"), true);
  assert.equal(candidateMatchesSearch(candidate, "node"), true);
  assert.equal(candidateMatchesSearch(candidate, "python"), false);
  assert.equal(candidateMatchesSearch(candidate, "   "), true);
});

test("getProfileUrl returns a clickable https URL when profile text exists", () => {
  assert.equal(
    getProfileUrl("linkedin.com/in/mayachen"),
    "https://linkedin.com/in/mayachen",
  );
  assert.equal(
    getProfileUrl("https://github.com/mayachen"),
    "https://github.com/mayachen",
  );
  assert.equal(getProfileUrl(null), null);
  assert.equal(getProfileUrl("   "), null);
});

test("getCandidatePdfUrl returns a trimmed PDF URL when one exists", () => {
  assert.equal(
    getCandidatePdfUrl({
      ...candidate,
      pdf_url: "  http://localhost:5000/uploads/resume.pdf  ",
    }),
    "http://localhost:5000/uploads/resume.pdf",
  );
  assert.equal(getCandidatePdfUrl(candidate), null);
});

test("sortCandidates orders candidates by score or newest creation date", () => {
  const buildCandidate = (
    id: number,
    score: number | null,
    created_at: string,
  ): Candidate => ({
    ...candidate,
    id,
    name: `Candidate ${id}`,
    score,
    created_at,
  });

  const candidates = [
    buildCandidate(1, 70, "2026-07-20T09:30:00.000Z"),
    buildCandidate(2, 95, "2026-07-21T09:30:00.000Z"),
    buildCandidate(3, null, "2026-07-24T09:30:00.000Z"),
    buildCandidate(4, 95, "2026-07-22T09:30:00.000Z"),
  ];

  const getSortedIds = (sortOption: CandidateSortOption): number[] =>
    sortCandidates(candidates, sortOption).map((candidateToRead) => candidateToRead.id);

  assert.deepEqual(getSortedIds("highest-score"), [4, 2, 1, 3]);
  assert.deepEqual(getSortedIds("lowest-score"), [1, 4, 2, 3]);
  assert.deepEqual(getSortedIds("newest-first"), [3, 4, 2, 1]);
  assert.deepEqual(
    candidates.map((candidateToRead) => candidateToRead.id),
    [1, 2, 3, 4],
  );
});

test("buildCandidatesCsv exports candidate fields with CSV escaping", () => {
  const candidates: Candidate[] = [
    {
      ...candidate,
      id: 1,
      name: "Maya Chen",
      email: "maya@example.com",
      skills: ["TypeScript", "Node.js"],
      summary: {
        en: "API builder, mentor.",
        fr: "Conceptrice API, mentor.",
        ar: "تبني واجهات برمجة وتوجه الفريق.",
      },
      score: 86,
    },
    {
      ...candidate,
      id: 2,
      name: 'Sam "Ace" Lee',
      email: null,
      skills: ["React"],
      summary: {
        en: "Ships UI\npolish.",
        fr: "Livre des interfaces soignees.",
        ar: "تنجز واجهات مصقولة.",
      },
      score: null,
    },
  ];

  assert.equal(
    buildCandidatesCsv(candidates),
    [
      "Name,Email,Score,Skills,Summary",
      'Maya Chen,maya@example.com,86,TypeScript; Node.js,"API builder, mentor."',
      '"Sam ""Ace"" Lee",,,React,"Ships UI\npolish."',
    ].join("\n"),
  );
});

test("getLocalizedSummary picks the active language and falls back to English", () => {
  assert.equal(
    getLocalizedSummary(candidate.summary, "fr"),
    "Ingenieure full-stack avec une solide experience API.",
  );
  assert.equal(
    getLocalizedSummary(candidate.summary, "ar-MA"),
    "مهندسة شاملة بخبرة قوية في واجهات البرمجة.",
  );
  assert.equal(
    getLocalizedSummary(
      {
        en: "English summary.",
        fr: "",
        ar: "",
      },
      "fr",
    ),
    "English summary.",
  );
  assert.equal(getLocalizedSummary(null, "en"), null);
});
