// Tone & Style: the tone dictation cleanup writes in, picked per kind of app.
// Category and tone values are the ones openwhispr-api's /api/reason accepts
// (`appCategory`, `tone`); main's toneAppCategories.js returns the same categories.

export const TONE_APP_CATEGORIES = ["personal", "work", "email", "other"] as const;
export type ToneAppCategory = (typeof TONE_APP_CATEGORIES)[number];

export type DictationTone = "formal" | "casual" | "very_casual" | "excited";

export const TONE_OPTIONS: Record<ToneAppCategory, readonly DictationTone[]> = {
  personal: ["formal", "casual", "very_casual"],
  work: ["formal", "casual", "excited"],
  email: ["formal", "casual", "excited"],
  other: ["formal", "casual", "excited"],
};

export type ToneStyles = Record<ToneAppCategory, DictationTone>;

// The design's preselected picks.
export const DEFAULT_TONE_STYLES: ToneStyles = {
  personal: "casual",
  work: "formal",
  email: "formal",
  other: "formal",
};

// How cleanup shapes the text for the app: `ai` is the usual cleanup, `raw`
// skips the cleanup model (dictionary and snippets still apply), `casual` adds
// a casual-formatting sentence to the cleanup prompt, `lowercase` lowercases
// the cleaned-up text.
export const DICTATION_FORMATS = ["ai", "raw", "casual", "lowercase"] as const;
export type DictationFormat = (typeof DICTATION_FORMATS)[number];

export type ToneFormats = Record<ToneAppCategory, DictationFormat>;

export const DEFAULT_TONE_FORMATS: ToneFormats = {
  personal: "ai",
  work: "ai",
  email: "ai",
  other: "ai",
};

// Words dictated before the setup dialog opens by itself on Home.
export const TONE_STYLE_PROMPT_MIN_WORDS = 70;

/**
 * What one dictation's cleanup is told: the app's category, the tone picked for
 * it and, unless it is the usual `ai` cleanup, the format picked for it.
 */
export interface DictationToneStyle {
  appCategory: ToneAppCategory;
  tone: DictationTone;
  format?: DictationFormat;
}

function readPerCategory<T extends string>(
  value: string,
  offered: (category: ToneAppCategory) => readonly T[],
  defaults: Record<ToneAppCategory, T>
): Record<ToneAppCategory, T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = null;
  }
  const stored = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  return Object.fromEntries(
    TONE_APP_CATEGORIES.map((category) => {
      const pick = stored[category];
      return [category, offered(category).includes(pick as T) ? pick : defaults[category]];
    })
  ) as Record<ToneAppCategory, T>;
}

/** Reads the stored JSON, keeping only tones offered for each category. */
export function normalizeToneStyles(value: string): ToneStyles {
  return readPerCategory(value, (category) => TONE_OPTIONS[category], DEFAULT_TONE_STYLES);
}

/** Reads the stored JSON, keeping only known formats. */
export function normalizeToneFormats(value: string): ToneFormats {
  return readPerCategory(value, () => DICTATION_FORMATS, DEFAULT_TONE_FORMATS);
}

export function resolveDictationFormat(
  toneFormats: ToneFormats,
  appCategory: ToneAppCategory | null
): DictationFormat {
  return toneFormats[appCategory ?? "other"];
}

/** Lowercases cleaned-up text when the app's format asks for it. */
export function applyDictationFormat(text: string, toneStyle?: DictationToneStyle | null) {
  return toneStyle?.format === "lowercase" ? text.toLowerCase() : text;
}

export function resolveDictationToneStyle(
  toneStyles: ToneStyles,
  appCategory: ToneAppCategory | null
): DictationToneStyle {
  const category = appCategory ?? "other";
  return { appCategory: category, tone: toneStyles[category] };
}
