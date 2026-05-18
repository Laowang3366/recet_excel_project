type IdLike = number | string;
const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function parseJsonText<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") {
    const parsed = parseJsonText<unknown>(value, value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export type AttachmentItem = {
  url: string;
  name?: string;
};

export function parseAttachments(value: unknown): AttachmentItem[] {
  const parsed = typeof value === "string" ? parseJsonText<unknown>(value, []) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item): AttachmentItem | null => {
      if (typeof item === "string") return { url: item };
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const url = record.url || record.path || record.fileUrl;
        if (typeof url === "string" && url) {
          return {
            url,
            name: typeof record.name === "string" ? record.name : undefined,
          };
        }
      }
      return null;
    })
    .filter((item): item is AttachmentItem => Boolean(item));
}

export function normalizeImageUrl(value?: string | null) {
  return normalizeResourceUrl(value);
}

export function normalizeAvatarUrl(value?: string | null, seed?: string | null) {
  const normalized = normalizeResourceUrl(value);
  if (normalized) return normalized;
  return buildDefaultAvatarDataUrl(seed);
}

export function normalizeResourceUrl(value?: string | null) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) {
    return `${API_BASE}${value}`;
  }
  return value;
}

function buildDefaultAvatarDataUrl(seed?: string | null) {
  const text = (seed || "U").trim();
  const initial = (text[0] || "U").toUpperCase();
  const hue = hashString(text || "user") % 360;
  const background = `hsl(${hue} 55% 62%)`;
  const foreground = "hsl(0 0% 100%)";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <rect width="128" height="128" rx="32" fill="${background}"/>
      <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
        font-family="Segoe UI, Arial, sans-serif" font-size="56" font-weight="700" fill="${foreground}">
        ${escapeXml(initial)}
      </text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function toId(value: IdLike | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}
