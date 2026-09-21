export function confirmDangerousAction(message: string): boolean {
  if (typeof window === "undefined") return false;
  return window.confirm(message);
}
