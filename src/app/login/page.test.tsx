import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The page invokes server actions via useActionState; stub them out.
vi.mock("./actions", () => ({
  signIn: vi.fn(async () => ({})),
  signUp: vi.fn(async () => ({})),
}));

import LoginPage from "./page";

describe("LoginPage", () => {
  it("renders the sign-in form by default", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    // no full name field in sign-in mode
    expect(screen.queryByPlaceholderText("Jane Doe")).not.toBeInTheDocument();
  });

  it("switches to the create-account form", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByText("Create account"));
    expect(screen.getByPlaceholderText("Jane Doe")).toBeInTheDocument();
  });
});
