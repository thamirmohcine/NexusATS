import assert from "node:assert/strict";
import test from "node:test";

import { analyzeResume, parseResumeAnalysisContent } from "../src/services/ai.js";

test("parseResumeAnalysisContent returns rich resume fields from JSON content", () => {
  const analysis = parseResumeAnalysisContent(
    JSON.stringify({
      candidateName: "Maya Chen",
      email: "maya@example.com",
      phone: "+1 555 0100",
      linkedin: "https://linkedin.com/in/mayachen",
      github: "https://github.com/mayachen",
      skills: ["TypeScript", "React", "Node.js"],
      experience: [
        {
          title: "Software Engineer",
          company: "Acme",
          duration: "2022-2026",
          description: "Built full-stack hiring tools.",
        },
      ],
      projects: [
        {
          name: "Candidate Screener",
          description: "Resume analysis dashboard.",
          technologies: ["React", "Express", "SQLite"],
        },
      ],
      summary: {
        en: "Full-stack engineer with product-minded experience.",
        fr: "Ingenieure full-stack avec une experience orientee produit.",
        ar: "مهندسة شاملة بخبرة تركز على المنتج.",
      },
      score: 92,
    }),
  );

  assert.equal(analysis.candidateName, "Maya Chen");
  assert.equal(analysis.email, "maya@example.com");
  assert.equal(analysis.phone, "+1 555 0100");
  assert.equal(analysis.linkedin, "https://linkedin.com/in/mayachen");
  assert.equal(analysis.github, "https://github.com/mayachen");
  assert.deepEqual(analysis.experience, [
    {
      title: "Software Engineer",
      company: "Acme",
      duration: "2022-2026",
      description: "Built full-stack hiring tools.",
    },
  ]);
  assert.deepEqual(analysis.projects, [
    {
      name: "Candidate Screener",
      description: "Resume analysis dashboard.",
      technologies: ["React", "Express", "SQLite"],
    },
  ]);
  assert.deepEqual(analysis.summary, {
    en: "Full-stack engineer with product-minded experience.",
    fr: "Ingenieure full-stack avec une experience orientee produit.",
    ar: "مهندسة شاملة بخبرة تركز على المنتج.",
  });
});

test("analyzeResume mock fallback returns the rich resume structure", async () => {
  const originalGroqApiKey = process.env.GROQ_API_KEY;
  const originalWarn = console.warn;
  const warningMessages: string[] = [];

  delete process.env.GROQ_API_KEY;
  console.warn = (message?: unknown): void => {
    warningMessages.push(String(message));
  };

  try {
    const analysis = await analyzeResume(
      "Maya Chen TypeScript React Node.js resume",
    );

    assert.equal(analysis.candidateName, "Maya Chen");
    assert.equal(analysis.email, null);
    assert.equal(analysis.phone, null);
    assert.equal(analysis.linkedin, null);
    assert.equal(analysis.github, null);
    assert.deepEqual(analysis.skills, [
      "TypeScript",
      "React",
      "Node.js",
      "Express",
      "SQL",
    ]);
    assert.deepEqual(analysis.experience, [
      {
        title: "Full-Stack Developer",
        company: "Sample Company",
        duration: "2+ years",
        description:
          "Built practical full-stack applications using TypeScript, React, Node.js, Express, and SQL.",
      },
    ]);
    assert.deepEqual(analysis.projects, [
      {
        name: "AI Candidate Screener",
        description:
          "A resume screening dashboard that analyzes candidate profiles and stores structured results.",
        technologies: ["TypeScript", "React", "Node.js", "Express", "SQL"],
      },
    ]);
    assert.deepEqual(analysis.summary, {
      en: "Strong candidate with solid full-stack fundamentals and practical project experience.",
      fr: "Candidat solide avec de bonnes bases full-stack et une experience pratique de projets.",
      ar: "مرشح قوي يمتلك أساسيات متينة في التطوير الشامل وخبرة عملية في المشاريع.",
    });
    assert.equal(analysis.score, 88);
    assert.deepEqual(warningMessages, ["[AI Service] Using mock response"]);
  } finally {
    console.warn = originalWarn;

    if (originalGroqApiKey === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = originalGroqApiKey;
    }
  }
});
