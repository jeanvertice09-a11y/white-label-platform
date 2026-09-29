export interface OnboardingItem {
  key: "identity" | "domain" | "plan" | "store" | "gateway";
  title: string;
  description: string;
  done: boolean;
  required: boolean;
  actionHref: string | null;
  actionLabel: string | null;
}

export interface ControlOnboardingData {
  tenantName: string;
  complete: boolean;
  completedRequired: number;
  requiredCount: number;
  items: OnboardingItem[];
}
