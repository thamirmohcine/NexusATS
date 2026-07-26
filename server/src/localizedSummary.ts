export interface LocalizedSummary {
  en: string;
  fr: string;
  ar: string;
}

export const createLocalizedSummary = (summary: string): LocalizedSummary => ({
  en: summary,
  fr: summary,
  ar: summary,
});

const normalizeText = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const normalizeLocalizedSummary = (
  value: unknown,
  fallback: LocalizedSummary,
): LocalizedSummary => {
  if (typeof value === "string") {
    return createLocalizedSummary(normalizeText(value, fallback.en));
  }

  if (!isRecord(value)) {
    return fallback;
  }

  const englishSummary = normalizeText(value.en, fallback.en);

  return {
    en: englishSummary,
    fr: normalizeText(value.fr, englishSummary),
    ar: normalizeText(value.ar, englishSummary),
  };
};

export const parseLocalizedSummary = (
  value: string | null,
): LocalizedSummary | null => {
  if (value === null) {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(trimmedValue);
    return normalizeLocalizedSummary(
      parsedValue,
      createLocalizedSummary(trimmedValue),
    );
  } catch {
    return createLocalizedSummary(trimmedValue);
  }
};
