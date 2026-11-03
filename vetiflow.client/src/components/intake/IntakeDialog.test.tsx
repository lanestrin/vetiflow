import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { apiUrl, server } from "../../test/server";
import { IntakeDialog } from "./IntakeDialog";

// jsdom has no modal dialogs; these behave like the browser's for the test.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

function openDialog() {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(<IntakeDialog isOpen onClose={onClose} onCreated={onCreated} />);
  return { dialog: screen.getByRole("dialog", { name: "New patient intake" }), onClose, onCreated };
}

function fillRequired(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText("Patient name *"), { target: { value: " Toby " } });
  fireEvent.change(within(dialog).getByLabelText("Species *"), { target: { value: "Dog" } });
  fireEvent.change(within(dialog).getByLabelText("Pet parent / guardian *"), { target: { value: "Jo Mills" } });
  fireEvent.change(within(dialog).getByLabelText("Phone number *"), { target: { value: "312-555-0177" } });
  fireEvent.change(within(dialog).getByLabelText("Chief complaint *"), { target: { value: "Acute vomiting" } });
  fireEvent.click(within(dialog).getByLabelText("Urgent"));
}

// The team for Patient assignments (4.1c).
const team = [
  { id: "vet-lee", displayName: "Dr. Jordan Lee", initials: "JL", role: "veterinarian", status: "available", activeCaseCount: 0, activeCases: [] },
  { id: "tech-chen", displayName: "Riley Chen", initials: "RC", role: "technician", status: "available", activeCaseCount: 0, activeCases: [] },
  { id: "tech-price", displayName: "Dana Price", initials: "DP", role: "technician", status: "busy", activeCaseCount: 0, activeCases: [] }
];

function serveTeam() {
  server.use(http.get(apiUrl("/api/staff/team"), () => HttpResponse.json(team)));
}

// The intake, then each assignment, recorded in the order they arrive.
function serveIntakeAndAssignments(statuses: Partial<Record<"technician" | "veterinarian", number>> = {}) {
  const sent: string[] = [];
  server.use(
    http.post(apiUrl("/api/cases/intake"), () => {
      sent.push("intake");
      return HttpResponse.json({ id: "case-9", caseNumber: "ER-2489", patientId: "patient-9" }, { status: 201 });
    })
  );
  for (const field of ["technician", "veterinarian"] as const) {
    server.use(http.put(apiUrl(`/api/cases/case-9/${field}`), async ({ request }) => {
      sent.push(`${field}:${(await request.json() as { id: string }).id}`);
      return new HttpResponse(null, { status: statuses[field] ?? 204 });
    }));
  }
  return sent;
}

async function chooseAssignments(dialog: HTMLElement, technician: string, veterinarian: string) {
  await within(dialog).findByRole("option", { name: "Riley Chen" });
  fireEvent.change(within(dialog).getByLabelText("Primary technician"), { target: { value: technician } });
  fireEvent.change(within(dialog).getByLabelText("Attending veterinarian (optional)"), { target: { value: veterinarian } });
}

function submit(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole("button", { name: "Add to triage queue" }));
}

describe("IntakeDialog", () => {
  it("shows the prototype's fields and wording", () => {
    const { dialog } = openDialog();

    expect(within(dialog).getByText("Patient flow")).toBeInTheDocument();
    expect(within(dialog).getByText("Capture arrival details, then add the patient to the triage queue.")).toBeInTheDocument();
    for (const label of [
      "Patient name *", "Species *", "Breed / description", "Age", "Pet parent / guardian *", "Phone number *",
      "Chief complaint *", "Triage notes", "Known allergies", "Current medications",
      "Initial treatment authorization", "Referring clinic (if applicable)"
    ]) {
      expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
    }
    const priority = within(dialog).getByRole("group", { name: "Initial priority *" });
    expect(within(priority).getAllByRole("radio").map((radio) => radio.getAttribute("value")))
      .toEqual(["critical", "urgent", "stable"]);
    expect(within(dialog).getByLabelText("Initial treatment authorization")).toHaveValue("notDiscussed");
    expect(within(dialog).getByText(/Priority is provisional until a clinician completes triage/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Patient name *")).toHaveFocus();
  });

  it("asks for every required field before sending", () => {
    const requests: string[] = [];
    server.events.on("request:start", ({ request }) => { requests.push(request.url); });
    const { dialog } = openDialog();

    submit(dialog);

    for (const [label, message] of [
      ["Patient name *", "Enter the patient's name."],
      ["Species *", "Choose the species."],
      ["Pet parent / guardian *", "Enter the pet parent's name."],
      ["Phone number *", "Enter a phone number."],
      ["Chief complaint *", "Enter the chief complaint."]
    ]) {
      const field = within(dialog).getByLabelText(label);
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAccessibleDescription(message);
    }
    expect(within(dialog).getByRole("group", { name: "Initial priority *" })).toHaveAccessibleDescription("Choose an initial priority.");
    expect(within(dialog).getByLabelText("Patient name *")).toHaveFocus();
    expect(requests).toEqual([]);
  });

  it("sends the intake, trimmed, and reports the new case", async () => {
    let body: unknown = null;
    server.use(http.post(apiUrl("/api/cases/intake"), async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ id: "case-9", caseNumber: "ER-2489", patientId: "patient-9" }, { status: 201 });
    }));
    const { dialog, onCreated } = openDialog();
    fillRequired(dialog);
    fireEvent.change(within(dialog).getByLabelText("Age"), { target: { value: "5 years" } });

    submit(dialog);

    expect(within(dialog).getByRole("button", { name: "Adding…" })).toBeDisabled();
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(
      { id: "case-9", caseNumber: "ER-2489", patientId: "patient-9" }, "Toby", []));
    expect(body).toEqual({
      petName: "Toby",
      species: "Dog",
      breed: null,
      age: "5 years",
      ownerName: "Jo Mills",
      ownerPhone: "312-555-0177",
      chiefComplaint: "Acute vomiting",
      priority: "urgent",
      triageNotes: null,
      allergies: null,
      medications: null,
      treatmentAuthorization: "notDiscussed",
      referringClinic: null
    });
  });

  it("shows the API's field errors and keeps what was typed", async () => {
    server.use(http.post(apiUrl("/api/cases/intake"), () =>
      HttpResponse.json({ status: 400, errors: { Age: ["Enter an age like 8 years, 6 months or 3 weeks."] } }, { status: 400 })));
    const { dialog, onCreated } = openDialog();
    fillRequired(dialog);
    fireEvent.change(within(dialog).getByLabelText("Age"), { target: { value: "old" } });

    submit(dialog);

    const age = within(dialog).getByLabelText("Age");
    await waitFor(() => expect(age).toHaveAccessibleDescription("Enter an age like 8 years, 6 months or 3 weeks."));
    expect(age).toHaveValue("old");
    expect(age).toHaveFocus();
    expect(within(dialog).getByLabelText("Patient name *")).toHaveValue(" Toby ");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("says plainly when the patient couldn't be added", async () => {
    server.use(http.post(apiUrl("/api/cases/intake"), () => new HttpResponse(null, { status: 500 })));
    const { dialog } = openDialog();
    fillRequired(dialog);

    submit(dialog);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The patient couldn't be added. Check the details and try again.");
    expect(within(dialog).getByRole("button", { name: "Add to triage queue" })).toBeEnabled();
  });

  it.each(["Cancel", "Close intake form"])("closes with %s", (name) => {
    const { dialog, onClose } = openDialog();

    fireEvent.click(within(dialog).getByRole("button", { name }));

    expect(onClose).toHaveBeenCalled();
  });

  // Patient assignments (4.1c): technician first, never blocking the intake.
  describe("patient assignments", () => {
    it("lists technicians first, then veterinarians, both Unassigned", async () => {
      serveTeam();
      const { dialog } = openDialog();

      const assignments = within(dialog).getByRole("group", { name: "Patient assignments" });
      expect(assignments).toHaveAccessibleDescription(
        "Assign a technician first when possible. Emergency care and vet assignment can proceed in either order.");
      await within(assignments).findByRole("option", { name: "Riley Chen" });
      const selects = within(assignments).getAllByRole("combobox");
      expect(selects.map((select) => select.getAttribute("name"))).toEqual(["technician", "veterinarian"]);
      expect(within(assignments).getByLabelText("Primary technician")).toHaveValue("");
      expect(within(selects[0]).getAllByRole("option").map((option) => option.textContent)).toEqual(["Unassigned", "Riley Chen", "Dana Price"]);
      expect(within(selects[1]).getAllByRole("option").map((option) => option.textContent)).toEqual(["Unassigned", "Dr. Jordan Lee"]);
      expect(within(assignments).getByLabelText("Attending veterinarian (optional)")).toHaveValue("");
      expect(within(assignments).getByText("You can save either assignment as Unassigned and update it later.")).toBeInTheDocument();
    });

    it("keeps Unassigned only and says so when the team cannot be loaded", async () => {
      server.use(http.get(apiUrl("/api/staff/team"), () => new HttpResponse(null, { status: 500 })));
      const sent = serveIntakeAndAssignments();
      const { dialog, onCreated } = openDialog();

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Unable to load the team. You can add the patient now and assign later.");
      expect(within(within(dialog).getByLabelText("Primary technician")).getAllByRole("option")).toHaveLength(1);
      fillRequired(dialog);
      submit(dialog);

      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "case-9" }), "Toby", []));
      expect(sent).toEqual(["intake"]);
    });

    it("loads the team again from Try again", async () => {
      server.use(http.get(apiUrl("/api/staff/team"), () => new HttpResponse(null, { status: 500 })));
      const { dialog } = openDialog();
      await within(dialog).findByRole("alert");
      serveTeam();

      fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));

      expect(await within(dialog).findByRole("option", { name: "Riley Chen" })).toBeInTheDocument();
      expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    });

    it("assigns the technician, then the veterinarian, after creating the case", async () => {
      serveTeam();
      const sent = serveIntakeAndAssignments();
      const { dialog, onCreated } = openDialog();
      fillRequired(dialog);
      await chooseAssignments(dialog, "tech-chen", "vet-lee");

      submit(dialog);

      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "case-9" }), "Toby", []));
      expect(sent).toEqual(["intake", "technician:tech-chen", "veterinarian:vet-lee"]);
      expect(within(dialog).getByLabelText("Primary technician")).toHaveValue("");
    });

    it("sends no assignment when both stay Unassigned", async () => {
      serveTeam();
      const sent = serveIntakeAndAssignments();
      const { dialog, onCreated } = openDialog();
      fillRequired(dialog);
      await within(dialog).findByRole("option", { name: "Riley Chen" });

      submit(dialog);

      await waitFor(() => expect(onCreated).toHaveBeenCalled());
      expect(sent).toEqual(["intake"]);
    });

    it("sends no assignment when the intake is refused", async () => {
      serveTeam();
      const sent = serveIntakeAndAssignments();
      server.use(http.post(apiUrl("/api/cases/intake"), () => new HttpResponse(null, { status: 500 })));
      const { dialog, onCreated } = openDialog();
      fillRequired(dialog);
      await chooseAssignments(dialog, "tech-chen", "vet-lee");

      submit(dialog);

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("The patient couldn't be added.");
      expect(sent).toEqual([]);
      expect(onCreated).not.toHaveBeenCalled();
      expect(within(dialog).getByLabelText("Primary technician")).toHaveValue("tech-chen");
    });

    it("reports an assignment that failed and still adds the patient once", async () => {
      serveTeam();
      const sent = serveIntakeAndAssignments({ technician: 500 });
      const { dialog, onCreated } = openDialog();
      fillRequired(dialog);
      await chooseAssignments(dialog, "tech-chen", "vet-lee");

      submit(dialog);

      await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "case-9" }), "Toby", ["technician"]);
      expect(sent).toEqual(["intake", "technician:tech-chen", "veterinarian:vet-lee"]);
      expect(dialog).not.toHaveAttribute("open");
    });
  });
});
