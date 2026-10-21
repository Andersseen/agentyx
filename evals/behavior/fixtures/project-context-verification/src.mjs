export function normalizeChannel(value) {
  return value.toLowerCase().trim().replaceAll(" ", "-");
}
