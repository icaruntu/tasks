import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UIProvider, useUI } from "./ui-provider";
import { FilterBar } from "./filter-bar";

function Harness() {
  const { filters } = useUI();
  return (
    <div>
      <FilterBar />
      <span data-testid="state">{JSON.stringify(filters)}</span>
    </div>
  );
}

function setup() {
  const user = userEvent.setup();
  render(
    <UIProvider>
      <Harness />
    </UIProvider>,
  );
  const state = () => JSON.parse(screen.getByTestId("state").textContent!);
  return { user, state };
}

describe("FilterBar", () => {
  it("updates the search filter", async () => {
    const { user, state } = setup();
    await user.type(screen.getByPlaceholderText("Search tasks…"), "milk");
    expect(state().search).toBe("milk");
  });

  it("opens the panel and toggles completion, due, priority", async () => {
    const { user, state } = setup();
    await user.click(screen.getByText("Filters"));

    await user.click(screen.getByText("Complete"));
    expect(state().completion).toBe("complete");

    await user.click(screen.getByLabelText("Due today"));
    expect(state().due).toBe("today");

    await user.click(screen.getByText("High"));
    expect(state().priorities).toContain("high");
    // toggling off
    await user.click(screen.getByText("High"));
    expect(state().priorities).not.toContain("high");
  });

  it("shows an active count badge and resets filters", async () => {
    const { user, state } = setup();
    await user.click(screen.getByText("Filters"));
    await user.click(screen.getByLabelText("Due tomorrow"));
    await user.click(screen.getByText("Medium"));
    // badge shows 2 active
    expect(screen.getByText("2")).toBeInTheDocument();

    await user.click(screen.getByText("Clear due date"));
    expect(state().due).toBeNull();

    await user.click(screen.getByText("Reset filters"));
    expect(state().priorities).toEqual([]);
    expect(state().completion).toBe("incomplete");
  });

  it("closes when clicking the backdrop", async () => {
    const { user } = setup();
    await user.click(screen.getByText("Filters"));
    expect(screen.getByText("Status")).toBeInTheDocument();
    // backdrop is the fixed inset overlay (first such element)
    const overlay = document.querySelector(".fixed.inset-0");
    await user.click(overlay as Element);
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
  });
});
