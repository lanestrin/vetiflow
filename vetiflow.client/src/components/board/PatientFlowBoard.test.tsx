import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { buildCase } from "../../test/builders";
import type { EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import type { BoardFilter } from "./BoardStats";
import { PatientFlowBoard } from "./PatientFlowBoard";

function renderBoard(cases: EmergencyCaseListItem[], updatedAt = new Date(), filter?: BoardFilter) {
  return render(
    <PatientFlowBoard cases={cases} updatedAt={updatedAt} selectedCaseId={null} onSelect={vi.fn()} filter={filter} />
  );
}

function table() {
  return screen.getByRole("table", { name: "Patient board" });
}

// The patients shown, top to bottom, by their name buttons.
function shownNames() {
  return within(table()).queryAllByRole("button").map((button) => button.textContent);
}

function rowOf(name: string) {
  return within(table()).getByRole("button", { name }).closest("tr") as HTMLElement;
}

describe("PatientFlowBoard", () => {
  it("shows the prototype's columns", () => {
    renderBoard([buildCase()]);

    expect(within(table()).getAllByRole("columnheader").map((header) => header.textContent))
      .toEqual(["Patient", "Acuity", "Care stage", "Care team", "Open"]);
  });

  // The API sorts by acuity and wait; the board must not reorder.
  it("lists the rows in the order the API sent them, with each case's acuity", () => {
    renderBoard([
      buildCase({ patientName: "Rex", acuity: null }),
      buildCase({ patientName: "Buddy", acuity: "critical" }),
      buildCase({ patientName: "Coco", acuity: "urgent" }),
      buildCase({ patientName: "Mittens", acuity: "stable" })
    ]);

    expect(shownNames()).toEqual(["Rex", "Buddy", "Coco", "Mittens"]);
    expect(within(rowOf("Rex")).getByText("Not triaged")).toBeInTheDocument();
    expect(within(rowOf("Buddy")).getByText("Critical")).toBeInTheDocument();
    expect(within(rowOf("Mittens")).getByText("Stable")).toBeInTheDocument();
  });

  it("has no acuity lanes or lane tabs", () => {
    renderBoard([buildCase({ acuity: "critical" })]);

    // The board itself is the only region.
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Show lane" })).not.toBeInTheDocument();
  });

  it("says when it was updated and how many cases are active", () => {
    renderBoard([buildCase(), buildCase()]);

    expect(screen.getByRole("heading", { level: 2, name: "Patient board" })).toBeInTheDocument();
    expect(screen.getByText(/Updated just now/)).toHaveTextContent("Updated just now·2 active cases");
    expect(screen.getByText("Showing 2 of 2 active patients")).toBeInTheDocument();
  });

  it("says how long ago it was updated", () => {
    renderBoard([buildCase()], new Date(Date.now() - 5 * 60_000));

    expect(screen.getByText(/Updated 5 min ago/)).toBeInTheDocument();
  });

  it("marks the selected row", () => {
    render(
      <PatientFlowBoard
        cases={[buildCase({ id: "case-milo", patientName: "Milo" }), buildCase({ patientName: "Pip" })]}
        updatedAt={new Date()}
        selectedCaseId="case-milo"
        onSelect={vi.fn()}
      />
    );

    expect(within(table()).getByRole("button", { name: "Milo" })).toHaveAttribute("aria-pressed", "true");
    expect(rowOf("Milo")).toHaveAttribute("data-selected", "true");
    expect(within(table()).getByRole("button", { name: "Pip" })).toHaveAttribute("aria-pressed", "false");
  });

  it("says so when no patients are on the board", () => {
    renderBoard([]);

    expect(within(table()).getByText("No patients on the board")).toBeInTheDocument();
  });

  describe("with a stat card filter", () => {
    const cases = () => [
      buildCase({ patientName: "Toby", acuity: "urgent", stage: "incoming" }),
      buildCase({ patientName: "Nori", acuity: "critical", stage: "incoming" }),
      buildCase({ patientName: "Milo", acuity: "critical", stage: "treatment" }),
      buildCase({ patientName: "Pip", acuity: "stable", stage: "recheck" })
    ];

    it("shows every row for all", () => {
      renderBoard(cases(), new Date(), "all");

      expect(shownNames()).toHaveLength(4);
      expect(screen.getByText("Showing 4 of 4 active patients")).toBeInTheDocument();
    });

    it("shows only incoming rows for awaiting triage", () => {
      renderBoard(cases(), new Date(), "awaitingTriage");

      expect(shownNames()).toEqual(["Toby", "Nori"]);
      expect(screen.getByText("Showing 2 of 4 active patients · awaiting triage · initial priority is provisional")).toBeInTheDocument();
    });

    it("shows only critical rows for critical", () => {
      renderBoard(cases(), new Date(), "critical");

      expect(shownNames()).toEqual(["Nori", "Milo"]);
      expect(screen.getByText("Showing 2 of 4 active patients · critical only")).toBeInTheDocument();
    });

    it("shows only critical patients without a veterinarian for that filter", () => {
      renderBoard([
        buildCase({ patientName: "Nori", acuity: "critical", assignedDoctor: null, assignedTechnician: { id: "t1", name: "Sam Cruz" } }),
        buildCase({ patientName: "Milo", acuity: "critical", assignedDoctor: { id: "v1", name: "Jordan Lee" } }),
        buildCase({ patientName: "Toby", acuity: "urgent", assignedDoctor: null })
      ], new Date(), "criticalWithoutVet");

      expect(shownNames()).toEqual(["Nori"]);
      expect(screen.getByText("Showing 1 of 3 active patients · critical without a veterinarian")).toBeInTheDocument();
    });

    it("shows only patients waiting for a vet assessment", () => {
      const assessment = { occurredAt: new Date().toISOString(), recordedAt: new Date().toISOString(), recordedBy: null };
      renderBoard([
        buildCase({ patientName: "Nori", vetAssessment: null }),
        buildCase({ patientName: "Milo", vetAssessment: assessment }),
        buildCase({ patientName: "Toby", vetAssessment: null, vetMilestone: "assessmentPending" })
      ], new Date(), "awaitingVet");

      expect(shownNames()).toEqual(["Nori", "Toby"]);
      expect(screen.getByText("Showing 2 of 3 active patients · waiting for a vet assessment")).toBeInTheDocument();
    });
  });

  // The top bar's search (build plan 2.14a).
  describe("with a search", () => {
    const cases = () => [
      buildCase({ patientName: "Milo", acuity: "critical", ownerName: "Avery Chen" }),
      buildCase({ patientName: "Mia", acuity: "urgent", ownerName: "Jo Mills" }),
      buildCase({ patientName: "Pip", acuity: "stable", ownerName: "Avery Chen" })
    ];

    function searchBoard(search: string, filter?: BoardFilter) {
      render(
        <MemoryRouter>
          <PatientFlowBoard
            cases={cases()}
            updatedAt={new Date()}
            selectedCaseId={null}
            onSelect={vi.fn()}
            filter={filter}
            search={search}
          />
        </MemoryRouter>
      );
    }

    it("shows only the matching rows", () => {
      searchBoard("mil");

      expect(shownNames()).toEqual(["Milo", "Mia"]);
    });

    it("says how many match and links to the Patients search", () => {
      searchBoard("  Avery ");

      expect(screen.getByText(/Showing 2 of \d+ active patients matching “Avery”/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Search all patients" })).toHaveAttribute("href", "/records?search=Avery");
    });

    it("still offers the Patients search when nothing on the board matches", () => {
      searchBoard("Rex");

      expect(shownNames()).toHaveLength(0);
      expect(within(table()).getByText("No patients match")).toBeInTheDocument();
      expect(screen.getByText(/Showing 0 of \d+ active patients matching “Rex”/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Search all patients" })).toHaveAttribute("href", "/records?search=Rex");
    });

    it("keeps the filter note and adds the match during a search", () => {
      searchBoard("Milo", "critical");

      expect(screen.getByText(/^Showing 1 of 3 active patients matching “Milo” · critical only/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Search all patients" })).toBeInTheDocument();
    });

    it("applies after the stat card filter", () => {
      searchBoard("Avery", "critical");

      expect(shownNames()).toEqual(["Milo"]);
    });

    it("shows every row and the usual foot for an empty search", () => {
      searchBoard("   ");

      expect(shownNames()).toHaveLength(3);
      expect(screen.getByText("Showing 3 of 3 active patients")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Search all patients" })).not.toBeInTheDocument();
    });
  });

  // The board header's scope and the toolbar (build plan 2.26b).
  describe("scope and toolbar", () => {
    const tech = { id: "t1", name: "Sam Cruz" };
    const vet = { id: "v1", name: "Jordan Lee" };
    const cases = () => [
      buildCase({ patientName: "Milo", acuity: "critical", stage: "incoming", assignedTechnician: tech, assignedDoctor: vet }),
      buildCase({ patientName: "Nori", acuity: "critical", stage: "treatment", assignedTechnician: tech, assignedDoctor: null }),
      buildCase({ patientName: "Toby", acuity: "urgent", stage: "incoming", assignedTechnician: null, assignedDoctor: vet }),
      buildCase({ patientName: "Pip", acuity: "stable", stage: "recheck", assignedTechnician: tech, assignedDoctor: vet })
    ];

    function showBoard(filter?: BoardFilter, search = "", onSearchChange = vi.fn()) {
      render(
        <MemoryRouter>
          <PatientFlowBoard cases={cases()} updatedAt={new Date()} selectedCaseId={null} onSelect={vi.fn()}
            filter={filter} search={search} onSearchChange={onSearchChange} />
        </MemoryRouter>
      );
      return onSearchChange;
    }

    const unassigned = () => screen.getByRole("button", { name: "Unassigned" });

    it("shows All patients selected with the case count", () => {
      showBoard();

      const scope = within(screen.getByRole("group", { name: "Patient scope" }));
      expect(scope.getByRole("button", { name: "All patients 4" })).toHaveAttribute("aria-pressed", "true");
    });

    it("keeps My patients focusable and unavailable without a demo identity", () => {
      showBoard();
      const myPatients = screen.getByRole("button", { name: "My patients" });
      const reason = "Available with the demo role switch on the ER board (2.28).";

      expect(myPatients).toHaveAttribute("aria-disabled", "true");
      expect(myPatients).not.toBeDisabled();
      expect(myPatients).toHaveAttribute("title", reason);
      expect(myPatients).toHaveAccessibleDescription(reason);
      myPatients.focus();
      fireEvent.click(myPatients);
      expect(myPatients).toHaveFocus();
      expect(myPatients).toHaveAttribute("aria-pressed", "false");
      expect(shownNames()).toHaveLength(4);
    });

    it("filters the board from its search box", () => {
      const onSearchChange = showBoard();

      fireEvent.change(screen.getByRole("searchbox", { name: "Search the board" }), { target: { value: "nori" } });

      expect(onSearchChange).toHaveBeenCalledWith("nori");
    });

    it("shows the shared search in its box", () => {
      showBoard(undefined, "nori");

      expect(screen.getByRole("searchbox", { name: "Search the board" })).toHaveValue("nori");
      expect(shownNames()).toEqual(["Nori"]);
    });

    it("shows only unassigned patients while Unassigned is pressed", () => {
      showBoard();
      expect(unassigned()).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(unassigned());

      expect(unassigned()).toHaveAttribute("aria-pressed", "true");
      expect(shownNames()).toEqual(["Nori", "Toby"]);
      expect(screen.getByText("Showing 2 of 4 active patients")).toBeInTheDocument();

      fireEvent.click(unassigned());

      expect(shownNames()).toHaveLength(4);
    });

    it("combines Unassigned with the stat filter and search", () => {
      showBoard("awaitingTriage", "to");

      fireEvent.click(unassigned());

      expect(shownNames()).toEqual(["Toby"]);
    });

    it("has no Incoming toggle", () => {
      showBoard();

      expect(screen.queryByRole("button", { name: /^Incoming/ })).not.toBeInTheDocument();
    });
  });

  // The Filter menu (build plan 2.14c).
  describe("with the Filter menu", () => {
    const lee = { id: "staff-lee", name: "Jordan Lee" };
    const cruz = { id: "staff-cruz", name: "Sam Cruz" };
    const cases = () => [
      buildCase({ patientName: "Milo", acuity: "critical", assignedDoctor: lee, assignedTechnician: cruz, species: "Dog" }),
      buildCase({ patientName: "Mia", acuity: "urgent", assignedDoctor: null, assignedTechnician: null, species: "Cat" }),
      buildCase({ patientName: "Pip", acuity: "stable", assignedDoctor: lee, assignedTechnician: null, species: "Cat" })
    ];

    function showBoard(filter?: BoardFilter, search?: string) {
      render(
        <MemoryRouter>
          <PatientFlowBoard
            cases={cases()}
            updatedAt={new Date()}
            selectedCaseId={null}
            onSelect={vi.fn()}
            filter={filter}
            search={search}
          />
        </MemoryRouter>
      );
      fireEvent.click(screen.getByRole("button", { name: /^Filter/ }));
    }

    function choose(name: string, value: string) {
      fireEvent.change(screen.getByRole("combobox", { name }), { target: { value } });
    }

    it("leaves only the chosen staff member's rows, with the foot to match", () => {
      showBoard();

      choose("Staff", "staff-lee");

      expect(shownNames()).toEqual(["Milo", "Pip"]);
      expect(screen.getByText("Showing 2 of 3 active patients")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Filter, 1 in use" })).toHaveAttribute("aria-pressed", "true");
    });

    it("leaves only the chosen acuity's rows", () => {
      showBoard();

      choose("Acuity", "urgent");

      expect(shownNames()).toEqual(["Mia"]);
    });

    // Jordan is the vet on Milo and Pip; only Pip still needs a technician.
    it("combines Unassigned with a staff member", () => {
      showBoard();
      choose("Staff", "staff-lee");

      fireEvent.click(screen.getByRole("button", { name: "Unassigned" }));

      expect(shownNames()).toEqual(["Pip"]);
    });

    it("applies with the critical filter", () => {
      showBoard("critical");

      choose("Species", "Cat");

      expect(shownNames()).toHaveLength(0);
    });

    it("applies with a search", () => {
      showBoard(undefined, "pip");

      choose("Species", "Cat");

      expect(shownNames()).toEqual(["Pip"]);
    });

    it("restores every row with Clear filters", () => {
      showBoard();
      choose("Staff", "no-veterinarian");
      expect(shownNames()).toEqual(["Mia"]);

      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

      expect(shownNames()).toHaveLength(3);
      expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("aria-pressed", "false");
    });
  });

  // The 2.14d sort, labelled Time in stage ↓ (build plan 2.26b).
  describe("Time in stage button", () => {
    const cases = () => [
      buildCase({ patientName: "Biscuit", acuity: "urgent", stageEnteredAt: "2026-10-28T11:55:00Z", species: "Dog" }),
      buildCase({ patientName: "Mochi", acuity: "urgent", stageEnteredAt: "2026-10-28T11:40:00Z", species: "Cat" }),
      buildCase({ patientName: "Pip", acuity: "stable", stageEnteredAt: "2026-10-28T11:30:00Z", species: "Cat" })
    ];

    function showBoard(search?: string) {
      render(
        <MemoryRouter>
          <PatientFlowBoard cases={cases()} updatedAt={new Date()} selectedCaseId={null} onSelect={vi.fn()} search={search} />
        </MemoryRouter>
      );
    }

    function priorityButton() {
      return screen.getByRole("button", { name: "Time in stage" });
    }

    it("explains the Time in stage sort", () => {
      showBoard();

      const explanation = "Longest time in current stage first, within each acuity. Acuity order stays Critical, Urgent, Stable.";
      expect(priorityButton()).toHaveTextContent("Time in stage ↓");
      expect(priorityButton()).toHaveAttribute("title", explanation);
      expect(priorityButton()).toHaveAccessibleDescription(explanation);
    });

    it("keeps the API order and is not pressed by default", () => {
      showBoard();

      expect(shownNames()).toEqual(["Biscuit", "Mochi", "Pip"]);
      expect(priorityButton()).toHaveAttribute("aria-pressed", "false");
    });

    // Pip has been in its stage longest, but Stable rows stay after Urgent ones.
    it("puts the case longest in its stage first within each acuity when pressed", () => {
      showBoard();

      fireEvent.click(priorityButton());

      expect(shownNames()).toEqual(["Mochi", "Biscuit", "Pip"]);
      expect(priorityButton()).toHaveAttribute("aria-pressed", "true");
    });

    it("restores the API order when pressed again", () => {
      showBoard();

      fireEvent.click(priorityButton());
      fireEvent.click(priorityButton());

      expect(shownNames()).toEqual(["Biscuit", "Mochi", "Pip"]);
    });

    it("keeps the order with a Filter menu choice", () => {
      showBoard();
      fireEvent.click(priorityButton());
      fireEvent.click(screen.getByRole("button", { name: /^Filter/ }));

      fireEvent.change(screen.getByRole("combobox", { name: "Species" }), { target: { value: "Cat" } });

      expect(shownNames()).toEqual(["Mochi", "Pip"]);
      expect(screen.getByText("Showing 2 of 3 active patients")).toBeInTheDocument();
    });

    it("keeps the order with a search", () => {
      showBoard("i");

      fireEvent.click(priorityButton());

      expect(shownNames()).toEqual(["Mochi", "Biscuit", "Pip"]);
    });
  });
});
