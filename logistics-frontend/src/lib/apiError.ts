export const extractMessage = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractMessage(item);
      if (nested) return nested;
    }
    return undefined;
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const nested = extractMessage((value as Record<string, unknown>)[key]);
      if (nested) return nested;
    }
  }
  return undefined;
};

export const parseApiError = (raw: string, fallback: string, status?: number) => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    const message =
      extractMessage((parsed as any)?.detail) ??
      extractMessage((parsed as any)?.data) ??
      extractMessage(parsed);
    if (message) return message;
  } catch {
    const trimmed = raw.trim();
    if (trimmed.startsWith("<")) {
      return `${fallback} (status ${status ?? "desconhecido"}). Verifique logs.`;
    }
  }
  return raw || fallback;
};
