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
      { id: "case-9", caseNumber: "ER-2489", patientId: "patient-9" }, "Toby"));
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
});
