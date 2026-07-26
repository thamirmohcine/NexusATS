import assert from "node:assert/strict";
import test from "node:test";

import type { AuthResponse, User } from "../src/types/auth";
import type { Candidate } from "../src/types/candidate";
import type { ChatMessage } from "../src/types/chat";
import type { NotificationItem } from "../src/types/notification";
import {
  fetchAdminUsers,
  loginUser,
  registerUser,
} from "../src/services/authService";
import {
  analyzeResume,
  deleteCandidate,
  fetchCandidates,
  uploadPdfResume,
} from "../src/services/candidateService";
import { getMessages, sendMessage } from "../src/services/chatService";
import {
  getNotifications,
  markNotificationAsRead,
  markNotificationsAsRead,
} from "../src/services/notificationService";

interface CapturedRequest {
  input: Parameters<typeof fetch>[0];
  init: Parameters<typeof fetch>[1];
}

const candidate: Candidate = {
  id: 7,
  user_id: 1,
  name: "Maya Chen",
  email: null,
  phone: null,
  linkedin: null,
  github: null,
  pdf_url: "http://localhost:5000/uploads/maya-resume.pdf",
  skills: ["TypeScript"],
  experience: [],
  projects: [],
  summary: {
    en: "Strong candidate.",
    fr: "Candidat solide.",
    ar: "مرشح قوي.",
  },
  score: 88,
  created_at: "2026-07-24T09:30:00.000Z",
};

const authResponse: AuthResponse = {
  token: "jwt-token",
  user: {
    id: 1,
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "admin",
  },
} as const;

const adminUsers: User[] = [
  {
    id: 1,
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "admin",
  },
];

const chatMessages: ChatMessage[] = [
  {
    id: 10,
    sender_id: 2,
    receiver_id: 1,
    candidate_id: 7,
    content: "Hello admin.",
    is_read: 0,
    created_at: "2026-07-24T09:30:00.000Z",
  },
];

const notifications: NotificationItem[] = [
  {
    id: 12,
    user_id: null,
    target_role: "admin",
    candidate_id: 7,
    sender_id: 2,
    type: "candidate_application",
    title: "New candidate application",
    content: "Maya Chen submitted a resume.",
    is_read: 0,
    created_at: "2026-07-24T09:35:00.000Z",
  },
];

test("fetchCandidates sends the auth token and returns candidates", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest: CapturedRequest | null = null;

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    capturedRequest = { input, init };

    return new Response(JSON.stringify([candidate]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const candidates = await fetchCandidates("jwt-token");

    assert.deepEqual(candidates, [candidate]);
    assert.equal(capturedRequest?.input, "http://localhost:5000/api/candidates");
    assert.deepEqual(capturedRequest?.init?.headers, {
      Authorization: "Bearer jwt-token",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("analyzeResume sends resume text with the auth token", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest: CapturedRequest | null = null;

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    capturedRequest = { input, init };

    return new Response(JSON.stringify(candidate), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const analyzedCandidate = await analyzeResume("resume text", "jwt-token");

    assert.deepEqual(analyzedCandidate, candidate);
    assert.equal(
      capturedRequest?.input,
      "http://localhost:5000/api/candidates/analyze",
    );
    assert.equal(capturedRequest?.init?.method, "POST");
    assert.deepEqual(capturedRequest?.init?.headers, {
      "Content-Type": "application/json",
      Authorization: "Bearer jwt-token",
    });
    assert.equal(
      capturedRequest?.init?.body,
      JSON.stringify({ resumeText: "resume text" }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uploadPdfResume posts a FormData file to the PDF upload endpoint with the auth token", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest: CapturedRequest | null = null;

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    capturedRequest = { input, init };

    return new Response(JSON.stringify(candidate), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const file = new File(["resume"], "resume.pdf", {
      type: "application/pdf",
    });
    const uploadedCandidate = await uploadPdfResume(file, "jwt-token");

    assert.deepEqual(uploadedCandidate, candidate);
    assert.equal(
      capturedRequest?.input,
      "http://localhost:5000/api/candidates/upload-pdf",
    );
    assert.equal(capturedRequest?.init?.method, "POST");
    assert.deepEqual(capturedRequest?.init?.headers, {
      Authorization: "Bearer jwt-token",
    });
    assert.ok(capturedRequest?.init?.body instanceof FormData);
    assert.equal(capturedRequest.init.body.get("file"), file);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uploadPdfResume throws the backend error message when upload fails", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ error: "PDF did not contain extractable text" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );

    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });

    await assert.rejects(
      uploadPdfResume(file, "jwt-token"),
      /PDF did not contain extractable text/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deleteCandidate sends a DELETE request with the auth token and returns the response message", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest: CapturedRequest | null = null;

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    capturedRequest = { input, init };

    return new Response(
      JSON.stringify({ message: "Candidate deleted successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    const deleteResponse = await deleteCandidate(7, "jwt-token");

    assert.deepEqual(deleteResponse, {
      message: "Candidate deleted successfully",
    });
    assert.equal(
      capturedRequest?.input,
      "http://localhost:5000/api/candidates/7",
    );
    assert.equal(capturedRequest?.init?.method, "DELETE");
    assert.deepEqual(capturedRequest?.init?.headers, {
      Authorization: "Bearer jwt-token",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loginUser posts credentials to the auth login endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest: CapturedRequest | null = null;

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    capturedRequest = { input, init };

    return new Response(JSON.stringify(authResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await loginUser("ada@example.com", "secret");

    assert.deepEqual(response, authResponse);
    assert.equal(capturedRequest?.input, "http://localhost:5000/api/auth/login");
    assert.equal(capturedRequest?.init?.method, "POST");
    assert.deepEqual(capturedRequest?.init?.headers, {
      "Content-Type": "application/json",
    });
    assert.equal(
      capturedRequest?.init?.body,
      JSON.stringify({ email: "ada@example.com", password: "secret" }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("registerUser posts registration details to the auth register endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest: CapturedRequest | null = null;

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    capturedRequest = { input, init };

    return new Response(JSON.stringify(authResponse), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await registerUser({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "secret",
      role: "admin",
    });

    assert.deepEqual(response, authResponse);
    assert.equal(
      capturedRequest?.input,
      "http://localhost:5000/api/auth/register",
    );
    assert.equal(capturedRequest?.init?.method, "POST");
    assert.deepEqual(capturedRequest?.init?.headers, {
      "Content-Type": "application/json",
    });
    assert.equal(
      capturedRequest?.init?.body,
      JSON.stringify({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "secret",
        role: "admin",
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("loginUser throws the backend error message when login fails", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (): Promise<Response> =>
    new Response(JSON.stringify({ error: "Invalid email or password" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  try {
    await assert.rejects(
      () => loginUser("ada@example.com", "wrong"),
      /Invalid email or password/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("fetchAdminUsers sends the auth token and returns admin users", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest: CapturedRequest | null = null;

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    capturedRequest = { input, init };

    return new Response(JSON.stringify(adminUsers), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await fetchAdminUsers("jwt-token");

    assert.deepEqual(response, adminUsers);
    assert.equal(capturedRequest?.input, "http://localhost:5000/api/auth/admins");
    assert.deepEqual(capturedRequest?.init?.headers, {
      Authorization: "Bearer jwt-token",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getMessages fetches a candidate chat with the auth token", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest: CapturedRequest | null = null;

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    capturedRequest = { input, init };

    return new Response(JSON.stringify(chatMessages), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await getMessages(7, "jwt-token");

    assert.deepEqual(response, chatMessages);
    assert.equal(capturedRequest?.input, "http://localhost:5000/api/chat/7");
    assert.deepEqual(capturedRequest?.init?.headers, {
      Authorization: "Bearer jwt-token",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sendMessage posts a chat message with the auth token", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest: CapturedRequest | null = null;

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    capturedRequest = { input, init };

    return new Response(JSON.stringify(chatMessages[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await sendMessage(
      {
        receiver_id: 1,
        candidate_id: 7,
        content: "Hello admin.",
      },
      "jwt-token",
    );

    assert.deepEqual(response, chatMessages[0]);
    assert.equal(capturedRequest?.input, "http://localhost:5000/api/chat/send");
    assert.equal(capturedRequest?.init?.method, "POST");
    assert.deepEqual(capturedRequest?.init?.headers, {
      "Content-Type": "application/json",
      Authorization: "Bearer jwt-token",
    });
    assert.equal(
      capturedRequest?.init?.body,
      JSON.stringify({
        receiver_id: 1,
        candidate_id: 7,
        content: "Hello admin.",
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sendMessage throws the backend error message when sending fails", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (): Promise<Response> =>
    new Response(JSON.stringify({ error: "Candidate not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });

  try {
    await assert.rejects(
      () =>
        sendMessage(
          {
            receiver_id: 1,
            candidate_id: 99,
            content: "Hello",
          },
          "jwt-token",
        ),
      /Candidate not found/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getNotifications fetches unread notifications with the auth token", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest: CapturedRequest | null = null;

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    capturedRequest = { input, init };

    return new Response(JSON.stringify(notifications), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await getNotifications("jwt-token");

    assert.deepEqual(response, notifications);
    assert.equal(
      capturedRequest?.input,
      "http://localhost:5000/api/notifications",
    );
    assert.deepEqual(capturedRequest?.init?.headers, {
      Authorization: "Bearer jwt-token",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("markNotificationsAsRead marks all notifications as read with the auth token", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest: CapturedRequest | null = null;
  const markReadResponse = { message: "Notifications marked as read" };

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    capturedRequest = { input, init };

    return new Response(JSON.stringify(markReadResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await markNotificationsAsRead("jwt-token");

    assert.deepEqual(response, markReadResponse);
    assert.equal(
      capturedRequest?.input,
      "http://localhost:5000/api/notifications/read-all",
    );
    assert.equal(capturedRequest?.init?.method, "PATCH");
    assert.deepEqual(capturedRequest?.init?.headers, {
      Authorization: "Bearer jwt-token",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("markNotificationAsRead marks a clicked notification as read with the auth token", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest: CapturedRequest | null = null;
  const markReadResponse = { message: "Notification marked as read" };

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    capturedRequest = { input, init };

    return new Response(JSON.stringify(markReadResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await markNotificationAsRead(12, "jwt-token");

    assert.deepEqual(response, markReadResponse);
    assert.equal(
      capturedRequest?.input,
      "http://localhost:5000/api/notifications/12/read",
    );
    assert.equal(capturedRequest?.init?.method, "PATCH");
    assert.deepEqual(capturedRequest?.init?.headers, {
      Authorization: "Bearer jwt-token",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getNotifications throws the backend error message when fetching fails", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (): Promise<Response> =>
    new Response(JSON.stringify({ error: "Invalid authorization token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  try {
    await assert.rejects(
      () => getNotifications("bad-token"),
      /Invalid authorization token/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
