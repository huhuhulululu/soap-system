function normalizeValues(values: string | string[]): string[] {
  if (Array.isArray(values)) {
    return values.map((v) => v.trim()).filter((v) => v.length > 0);
  }
  const trimmed = values.trim();
  return trimmed ? [trimmed] : [];
}

export function escapeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildOptionClass(options: readonly string[]): string {
  return options.map((opt) => escapeHtmlEntities(opt)).join("|");
}

export function wrapSingle(value: string, options: readonly string[]): string {
  const escapedValue = escapeHtmlEntities(value);
  const escapedOptions = buildOptionClass(options);
  const className = escapedOptions
    ? `ppnSelectComboSingle ${escapedOptions}`
    : "ppnSelectComboSingle";
  return `<span class="${className}">${escapedValue}</span>`;
}

export function wrapMulti(
  values: string | string[],
  options: readonly string[],
): string {
  const text = normalizeValues(values).join(", ");
  const escapedValue = escapeHtmlEntities(text);
  const escapedOptions = buildOptionClass(options);
  const className = escapedOptions
    ? `ppnSelectCombo ${escapedOptions}`
    : "ppnSelectCombo";
  return `<span class="${className}">${escapedValue}</span>`;
}

export function createFormatWrappers(format: "text" | "html"): {
  wrapSingleIfNeeded: (value: string, options: readonly string[]) => string;
  wrapMultiIfNeeded: (
    value: string | string[],
    options: readonly string[],
  ) => string;
} {
  const isHtml = format === "html";
  return {
    wrapSingleIfNeeded: (value, options) =>
      isHtml ? wrapSingle(value, options) : value,
    wrapMultiIfNeeded: (value, options) =>
      isHtml
        ? wrapMulti(value, options)
        : Array.isArray(value)
          ? value.join(", ")
          : value,
  };
}
