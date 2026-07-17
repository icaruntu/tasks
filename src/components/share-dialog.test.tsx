import { describe, it, expect } from "vitest";
import { renderApp, screen } from "@/test/render";
import { ShareDialog } from "./share-dialog";
import { makeProfile, makeProject, makeMember } from "@/test/factories";

// Owner can search connected profiles and add/manage members.
const baseSeed = {
  profiles: [
    makeProfile({ id: "user-1", full_name: "Me" }),
    makeProfile({ id: "collab", full_name: "Coll Aborator", email: "coll@x.io" }),
  ],
  projects: [makeProject({ id: "pr1", owner_id: "user-1", name: "Roadmap" })],
  project_members: [],
  collaborators: [{ user_id: "user-1", collaborator_id: "collab" }],
};

describe("ShareDialog", () => {
  it("renders project name and owner", async () => {
    await renderApp(<ShareDialog projectId="pr1" onClose={() => {}} />, {
      seed: baseSeed,
    });
    expect(screen.getByText(/Roadmap/)).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("searches connected profiles and adds a member", async () => {
    const { user, supabase } = await renderApp(
      <ShareDialog projectId="pr1" onClose={() => {}} />,
      { seed: baseSeed },
    );
    await user.type(screen.getByPlaceholderText(/Invite by name or email/), "coll");
    await user.click(await screen.findByText("Add"));
    expect(supabase._store.project_members).toHaveLength(1);
  });

  it("does not surface strangers (only connected profiles)", async () => {
    await renderApp(<ShareDialog projectId="pr1" onClose={() => {}} />, {
      seed: {
        ...baseSeed,
        profiles: [
          ...baseSeed.profiles,
          makeProfile({ id: "stranger", full_name: "Random Stranger" }),
        ],
      },
    });
    const { findByPlaceholderText } = screen;
    const input = await findByPlaceholderText(/Invite by name or email/);
    await import("@testing-library/user-event").then(({ default: ue }) =>
      ue.setup().type(input, "Random"),
    );
    expect(screen.getByText(/No matching collaborators/)).toBeInTheDocument();
  });

  it("lets the owner change a role and remove a member", async () => {
    const { user, supabase } = await renderApp(
      <ShareDialog projectId="pr1" onClose={() => {}} />,
      {
        seed: {
          ...baseSeed,
          project_members: [makeMember({ project_id: "pr1", user_id: "collab", role: "editor" })],
        },
      },
    );
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "viewer");
    expect(supabase._store.project_members[0].role).toBe("viewer");
    await user.click(screen.getByTitle("Remove"));
    expect(supabase._store.project_members).toHaveLength(0);
  });

  it("a non-owner member can leave the project", async () => {
    const { user, supabase } = await renderApp(
      <ShareDialog projectId="pr1" onClose={() => {}} />,
      {
        seed: {
          profiles: [makeProfile({ id: "user-1" }), makeProfile({ id: "owner" })],
          projects: [makeProject({ id: "pr1", owner_id: "owner" })],
          project_members: [makeMember({ project_id: "pr1", user_id: "user-1" })],
          collaborators: [],
        },
      },
    );
    await user.click(screen.getByText("Leave project"));
    expect(supabase._store.project_members).toHaveLength(0);
  });
});
