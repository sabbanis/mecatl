import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateSkillDialog } from "./create-skill-dialog";

/**
 * Pins the create dialog: the submit gate (grammar-valid name + non-empty
 * body), the create call with exactly what the form holds, the client-side
 * upload path (file → textarea + derived name), and a controller refusal
 * rendering verbatim while the dialog stays open.
 */

const create = vi.fn<(name: string, body: string) => Promise<void>>(() =>
  Promise.resolve(),
);
const onCreated = vi.fn<(name: string) => void>();

beforeEach(() => {
  create.mockClear();
  create.mockImplementation(() => Promise.resolve());
  onCreated.mockClear();
});

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<CreateSkillDialog create={create} onCreated={onCreated} />);
  await user.click(screen.getByRole("button", { name: /New skill/ }));
  return screen.findByRole("dialog");
}

describe("create skill dialog", () => {
  it("seeds the SKILL.md template and warns about the restart", async () => {
    const user = userEvent.setup();
    await openDialog(user);

    expect(
      screen.getByText(/Creating a skill restarts the daemon/),
    ).toBeTruthy();
    const body = screen.getByRole("textbox", { name: "SKILL.md content" });
    expect((body as HTMLTextAreaElement).value).toContain("description:");

    // Name empty → invalid → the gate holds and the rule shows as helper text.
    expect(
      (
        screen.getByRole("button", {
          name: "Create skill",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText(/Lowercase letters, digits/)).toBeTruthy();
  });

  it("keeps Create disabled while the name breaks the grammar", async () => {
    const user = userEvent.setup();
    await openDialog(user);

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Bad Name");
    expect(
      (
        screen.getByRole("button", {
          name: "Create skill",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText(/Lowercase letters, digits/)).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it("creates with the typed name and body, then closes and reports the name", async () => {
    const user = userEvent.setup();
    await openDialog(user);

    await user.type(screen.getByRole("textbox", { name: "Name" }), "my-skill");
    // A valid name hides the rule and opens the gate.
    expect(screen.queryByText(/Lowercase letters, digits/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Create skill" }));

    expect(create).toHaveBeenCalledTimes(1);
    const [name, body] = create.mock.calls[0];
    expect(name).toBe("my-skill");
    expect(body).toContain("description:");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onCreated).toHaveBeenCalledWith("my-skill");
  });

  it("renders a controller refusal verbatim and stays open", async () => {
    create.mockImplementation(() =>
      Promise.reject(new Error('A skill named "my-skill" already exists')),
    );
    const user = userEvent.setup();
    await openDialog(user);

    await user.type(screen.getByRole("textbox", { name: "Name" }), "my-skill");
    await user.click(screen.getByRole("button", { name: "Create skill" }));

    expect(
      await screen.findByText('A skill named "my-skill" already exists'),
    ).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("reads an uploaded file into the body and derives the empty name", async () => {
    const user = userEvent.setup();
    await openDialog(user);

    const content = "---\nname: Uploaded Helper\n---\n# Do the thing\n";
    await user.upload(
      screen.getByLabelText("Upload a SKILL.md file"),
      new File([content], "Some Notes.md", { type: "text/markdown" }),
    );

    // FileReader resolves asynchronously: wait for the body to adopt the file.
    await waitFor(() => {
      const body = screen.getByRole("textbox", { name: "SKILL.md content" });
      expect((body as HTMLTextAreaElement).value).toBe(content);
    });
    expect(
      (screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value,
    ).toBe("uploaded-helper");
    expect(screen.getByText("Some Notes.md")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Create skill",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("never overwrites a name the user already typed", async () => {
    const user = userEvent.setup();
    await openDialog(user);

    await user.type(screen.getByRole("textbox", { name: "Name" }), "kept-name");
    await user.upload(
      screen.getByLabelText("Upload a SKILL.md file"),
      new File(["---\nname: other\n---\nbody"], "other.md", {
        type: "text/markdown",
      }),
    );

    await waitFor(() =>
      expect(
        (
          screen.getByRole("textbox", { name: "SKILL.md content" }) as
            | HTMLTextAreaElement
            | HTMLInputElement
        ).value,
      ).toContain("other"),
    );
    expect(
      (screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value,
    ).toBe("kept-name");
  });
});
