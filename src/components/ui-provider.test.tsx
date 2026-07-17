import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UIProvider, useUI } from "./ui-provider";

function Probe() {
  const { openTaskId, openTask, filters, setFilters, pomodoroTaskId, setPomodoroTaskId } =
    useUI();
  return (
    <div>
      <span data-testid="open">{openTaskId ?? "none"}</span>
      <span data-testid="search">{filters.search}</span>
      <span data-testid="pomo">{pomodoroTaskId ?? "none"}</span>
      <button onClick={() => openTask("t1")}>open</button>
      <button onClick={() => setFilters((f) => ({ ...f, search: "hi" }))}>search</button>
      <button onClick={() => setPomodoroTaskId("p1")}>pomo</button>
    </div>
  );
}

describe("UIProvider", () => {
  it("provides and updates UI state", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider>
        <Probe />
      </UIProvider>,
    );
    expect(screen.getByTestId("open")).toHaveTextContent("none");
    await user.click(screen.getByText("open"));
    expect(screen.getByTestId("open")).toHaveTextContent("t1");
    await user.click(screen.getByText("search"));
    expect(screen.getByTestId("search")).toHaveTextContent("hi");
    await user.click(screen.getByText("pomo"));
    expect(screen.getByTestId("pomo")).toHaveTextContent("p1");
  });

  it("throws when useUI is used outside the provider", () => {
    function Bad() {
      useUI();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/useUI must be used inside/);
  });
});
