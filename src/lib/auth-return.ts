export function safeAuthReturn(value: unknown) {
  return value === "/" || value === "/subscription" ? value : undefined;
}