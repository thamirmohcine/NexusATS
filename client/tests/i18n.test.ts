import assert from "node:assert/strict";
import test from "node:test";

import {
  getTextDirection,
  supportedLanguages,
  translationResources,
} from "../src/i18n";

const requiredNamespaces = [
  "auth",
  "candidatePortal",
  "adminDashboard",
  "chat",
  "notifications",
  "theme",
] as const;

test("supported languages include English, French, and Arabic with RTL only for Arabic", () => {
  assert.deepEqual(
    supportedLanguages.map((language) => language.code),
    ["en", "fr", "ar"],
  );
  assert.equal(getTextDirection("en"), "ltr");
  assert.equal(getTextDirection("fr"), "ltr");
  assert.equal(getTextDirection("ar"), "rtl");
  assert.equal(getTextDirection("ar-SA"), "rtl");
});

test("translation resources include the required product areas for each language", () => {
  for (const language of supportedLanguages) {
    const resource = translationResources[language.code].translation;

    for (const namespace of requiredNamespaces) {
      assert.equal(
        typeof resource[namespace],
        "object",
        `${language.code} is missing ${namespace} translations`,
      );
    }
  }
});

test("header translations do not include the removed resume intelligence eyebrow", () => {
  const removedEyebrowText = new Set([
    "Resume intelligence",
    "Intelligence CV",
    "ذكاء السيرة الذاتية",
  ]);

  for (const language of supportedLanguages) {
    const header = translationResources[language.code].translation.header;

    assert.equal(
      Object.hasOwn(header, "eyebrow"),
      false,
      `${language.code} should not define header.eyebrow`,
    );
    assert.equal(
      Object.values(header).some(
        (value) => typeof value === "string" && removedEyebrowText.has(value),
      ),
      false,
      `${language.code} should not contain the removed eyebrow text`,
    );
  }
});
