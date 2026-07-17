import { describe, it, expect } from "vitest";
import { PLAN_LIMITS, PLAN_META, isPaid } from "./plans";

describe("plans", () => {
  it("free tier disables AI and caps projects/members", () => {
    expect(PLAN_LIMITS.free.aiRequestsPerMonth).toBe(0);
    expect(PLAN_LIMITS.free.maxProjects).toBe(5);
    expect(PLAN_LIMITS.free.maxMembersPerProject).toBe(2);
  });

  it("paid tiers unlock unlimited projects", () => {
    expect(PLAN_LIMITS.pro.maxProjects).toBe(Infinity);
    expect(PLAN_LIMITS.team.maxProjects).toBe(Infinity);
    expect(PLAN_LIMITS.team.aiRequestsPerMonth).toBeGreaterThan(
      PLAN_LIMITS.pro.aiRequestsPerMonth,
    );
  });

  it("has display metadata for every plan", () => {
    for (const plan of ["free", "pro", "team"] as const) {
      expect(PLAN_META[plan].name).toBeTruthy();
      expect(PLAN_META[plan].features.length).toBeGreaterThan(0);
    }
  });

  it("isPaid is true only for pro and team", () => {
    expect(isPaid("free")).toBe(false);
    expect(isPaid("pro")).toBe(true);
    expect(isPaid("team")).toBe(true);
  });
});
