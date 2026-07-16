export type Plan = "free" | "pro" | "team";

export type PlanLimits = {
  maxProjects: number; // Infinity for unlimited
  maxMembersPerProject: number;
  aiRequestsPerMonth: number;
  storageMb: number;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxProjects: 5,
    maxMembersPerProject: 2,
    aiRequestsPerMonth: 0,
    storageMb: 100,
  },
  pro: {
    maxProjects: Infinity,
    maxMembersPerProject: Infinity,
    aiRequestsPerMonth: 500,
    storageMb: 2000,
  },
  team: {
    maxProjects: Infinity,
    maxMembersPerProject: Infinity,
    aiRequestsPerMonth: 2000,
    storageMb: 10000,
  },
};

export const PLAN_META: Record<
  Plan,
  { name: string; tagline: string; priceLabel: string; features: string[] }
> = {
  free: {
    name: "Free",
    tagline: "For personal use",
    priceLabel: "$0",
    features: [
      "Up to 5 projects",
      "List, board & calendar views",
      "Pomodoro timer",
      "Up to 2 collaborators",
    ],
  },
  pro: {
    name: "Pro",
    tagline: "For power users",
    priceLabel: "$5/mo",
    features: [
      "Unlimited projects",
      "Due-date reminders & daily email",
      "Recurring tasks",
      "AI: capture, prioritize, plan my day",
      "2 GB attachments",
    ],
  },
  team: {
    name: "Team",
    tagline: "For teams",
    priceLabel: "$10/user/mo",
    features: [
      "Everything in Pro",
      "Unlimited sharing & roles",
      "Higher AI limits",
      "Admin controls",
      "Priority support",
    ],
  },
};

export function isPaid(plan: Plan): boolean {
  return plan === "pro" || plan === "team";
}
