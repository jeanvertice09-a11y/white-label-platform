export type LoginSearch = { onboarding?: true };

function isOnboardingEnabled(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function parseLoginSearch(search: Record<string, unknown>): LoginSearch {
  return { onboarding: isOnboardingEnabled(search["onboarding"]) ? true : undefined };
}

export function postLoginLocation(destination: string): string {
  return destination === "/control" ? "/login?onboarding=true" : destination;
}
