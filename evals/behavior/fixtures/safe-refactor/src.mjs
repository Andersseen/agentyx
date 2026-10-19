export function normalizeTags(values) {
  const result = [];
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized.length > 0 && result.indexOf(normalized) === -1) result.push(normalized);
    }
  }
  return result;
}

export function summarizeTags(values) {
  return normalizeTags(values).join(", ");
}
