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

function lane(name: string) {
  return screen.getByRole("region", { name });
}

describe("PatientFlowBoard", () => {
  it("counts the cases in each acuity lane", () => {
    renderBoard([
      buildCase({ acuity: "critical" }),
      buildCase({ acuity: "urgent" }),
      buildCase({ acuity: "urgent" })
    ]);

    expect(within(lane("Critical")).getByText("1")).toBeInTheDocument();
    expect(within(lane("Urgent")).getByText("2")).toBeInTheDocument();
    expect(within(lane("Stable")).getByText("0")).toBeInTheDocument();
    expect(within(lane("Stable")).getByText("No patients")).toBeInTheDocument();
  });

  it("says when it was updated and how many cases are active", () => {
    renderBoard([buildCase(), buildCase()]);

    expect(screen.getByRole("heading", { level: 2, name: "Patient flow" })).toBeInTheDocument();
    expect(screen.getByText(/Updated just now/)).toHaveTextContent("Updated just now·2 active cases");
    expect(screen.getByText("Showing 2 of 2 active cases")).toBeInTheDocument();
  });

  it("says how long ago it was updated", () => {
    renderBoard([buildCase()], new Date(Date.now() - 5 * 60_000));

    expect(screen.getByText(/Updated 5 min ago/)).toBeInTheDocument();
  });

  // Only old data has no acuity; such cases must not disappear.
  it("adds a Not triaged lane only when a case has no acuity", () => {
    renderBoard([buildCase({ patientName: "Rex", acuity: null })]);

    expect(within(lane("Not triaged")).getByRole("heading", { name: "Rex" })).toBeInTheDocument();
  });

  it("has no Not triaged lane when every case has an acuity", () => {
    renderBoard([buildCase({ acuity: "stable" })]);

    expect(screen.queryByRole("region", { name: "Not triaged" })).not.toBeInTheDocument();
  });

  it("shows the lane of a newly selected case at phone width", () => {
    const cases = [buildCase({ acuity: "critical" }), buildCase({ id: "case-pip", acuity: "stable" })];
    const { rerender } = render(
      <PatientFlowBoard cases={cases} updatedAt={new Date()} selectedCaseId={null} onSelect={vi.fn()} />
    );

    rerender(<PatientFlowBoard cases={cases} updatedAt={new Date()} selectedCaseId="case-pip" onSelect={vi.fn()} />);

    expect(lane("Stable")).toHaveAttribute("data-shown", "true");
    expect(lane("Critical")).toHaveAttribute("data-shown", "false");
  });

  it("switches the lane shown at phone width with the lane tabs", () => {
    renderBoard([buildCase({ acuity: "critical" })]);
    const tabs = screen.getByRole("group", { name: "Show lane" });

    expect(within(tabs).getByRole("button", { name: "Critical" })).toHaveAttribute("aria-pressed", "true");
    expect(lane("Critical")).toHaveAttribute("data-shown", "true");

    fireEvent.click(within(tabs).getByRole("button", { name: "Stable" }));

    expect(lane("Stable")).toHaveAttribute("data-shown", "true");
    expect(lane("Critical")).toHaveAttribute("data-shown", "false");
  });

  describe("with a stat card filter", () => {
    const cases = () => [
      buildCase({ patientName: "Toby", acuity: "urgent", stage: "incoming" }),
      buildCase({ patientName: "Nori", acuity: "critical", stage: "incoming" }),
      buildCase({ patientName: "Milo", acuity: "critical", stage: "treatment" }),
      buildCase({ patientName: "Pip", acuity: "stable", stage: "recheck" })
    ];

    it("shows every card for all", () => {
      renderBoard(cases(), new Date(), "all");

      expect(screen.getAllByRole("article")).toHaveLength(4);
      expect(screen.getByText("Showing 4 of 4 active cases")).toBeInTheDocument();
    });

    it("shows only incoming cards, in every lane, for awaiting triage", () => {
      renderBoard(cases(), new Date(), "awaitingTriage");

      expect(within(lane("Urgent")).getByRole("heading", { name: "Toby" })).toBeInTheDocument();
      expect(within(lane("Critical")).getByRole("heading", { name: "Nori" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Milo" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Pip" })).not.toBeInTheDocument();
      expect(screen.getByText("Showing 2 awaiting triage cases · initial priority is provisional")).toBeInTheDocument();
      // Stacked at phone width: no lane hides behind a tab.
      expect(screen.queryByRole("group", { name: "Show lane" })).not.toBeInTheDocument();
      expect(lane("Stable")).toHaveAttribute("data-shown", "true");
    });

    it("shows only the Critical lane for critical", () => {
      renderBoard(cases(), new Date(), "critical");

      expect(screen.getAllByRole("region").map((region) => region.getAttribute("data-lane")).filter(Boolean))
        .toEqual(["critical"]);
      expect(within(lane("Critical")).getAllByRole("article")).toHaveLength(2);
      expect(screen.getByText("Showing 2 critical patients · other acuity lanes hidden")).toBeInTheDocument();
    });

    it("switches the phone tab to Critical when the critical filter is chosen", () => {
      const { rerender } = renderBoard(cases(), new Date(), "all");
      const tabs = screen.getByRole("group", { name: "Show lane" });
      fireEvent.click(within(tabs).getByRole("button", { name: "Stable" }));

      rerender(
        <PatientFlowBoard cases={cases()} updatedAt={new Date()} selectedCaseId={null} onSelect={vi.fn()} filter="critical" />
      );

      expect(lane("Critical")).toHaveAttribute("data-shown", "true");
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

    it("shows only the matching cards, with lane counts for them", () => {
      searchBoard("mil");

      expect(within(lane("Critical")).getByRole("heading", { name: "Milo" })).toBeInTheDocument();
      expect(within(lane("Urgent")).getByRole("heading", { name: "Mia" })).toBeInTheDocument();
      expect(within(lane("Stable")).getByText("0")).toBeInTheDocument();
      expect(within(lane("Stable")).getByText("No patients")).toBeInTheDocument();
    });

    it("says how many match and links to the Patients search", () => {
      searchBoard("  Avery ");

      expect(screen.getByText(/Showing 2 matching “Avery”/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Search all patients" })).toHaveAttribute("href", "/records?search=Avery");
    });

    it("still offers the Patients search when nothing on the board matches", () => {
      searchBoard("Rex");

      expect(screen.queryAllByRole("article")).toHaveLength(0);
      expect(screen.getByText(/Showing 0 matching “Rex”/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Search all patients" })).toHaveAttribute("href", "/records?search=Rex");
    });

    it("applies after the stat card filter", () => {
      searchBoard("Avery", "critical");

      expect(screen.getAllByRole("article")).toHaveLength(1);
      expect(screen.getByRole("heading", { name: "Milo" })).toBeInTheDocument();
    });

    it("shows every card and the usual foot for an empty search", () => {
      searchBoard("   ");

      expect(screen.getAllByRole("article")).toHaveLength(3);
      expect(screen.getByText("Showing 3 of 3 active cases")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Search all patients" })).not.toBeInTheDocument();
    });
  });

  // The Incoming toggle (build plan 2.14b).
  describe("Incoming toggle", () => {
    const cases = () => [
      buildCase({ acuity: "urgent", stage: "incoming" }),
      buildCase({ acuity: "stable", stage: "incoming" }),
      buildCase({ acuity: "critical", stage: "treatment" })
    ];

    function showToggle(filter: BoardFilter, onFilter = vi.fn()) {
      render(
        <PatientFlowBoard
          cases={cases()}
          updatedAt={new Date()}
          selectedCaseId={null}
          onSelect={vi.fn()}
          filter={filter}
          onFilter={onFilter}
        />
      );
      return onFilter;
    }

    function toggle() {
      return screen.getByRole("button", { name: /^Incoming/ });
    }

    it("counts the incoming cases", () => {
      showToggle("all");

      expect(toggle()).toHaveAccessibleName("Incoming, 2 awaiting triage");
      expect(toggle()).toHaveTextContent("⇣ Incoming 2");
    });

    it("is pressed only while the board shows the triage queue", () => {
      showToggle("awaitingTriage");

      expect(toggle()).toHaveAttribute("aria-pressed", "true");
    });

    it.each<[BoardFilter, BoardFilter]>([
      ["all", "awaitingTriage"],
      ["critical", "awaitingTriage"],
      ["awaitingTriage", "all"]
    ])("from %s asks for %s", (from, asked) => {
      const onFilter = showToggle(from);
      expect(toggle()).toHaveAttribute("aria-pressed", String(from === "awaitingTriage"));

      fireEvent.click(toggle());

      expect(onFilter).toHaveBeenCalledWith(asked);
    });
  });

  // The Filter menu (build plan 2.14c).
  describe("with the Filter menu", () => {
    const reed = { id: "staff-reed", shortName: "Reed", initials: "JR" };
    const cases = () => [
      buildCase({ patientName: "Milo", acuity: "critical", clinician: reed, species: "Dog" }),
      buildCase({ patientName: "Mia", acuity: "urgent", clinician: null, species: "Cat" }),
      buildCase({ patientName: "Pip", acuity: "stable", clinician: reed, species: "Cat" })
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

    it("leaves only the chosen clinician's cards, with lane counts and the foot to match", () => {
      showBoard();

      choose("Clinician", "staff-reed");

      expect(screen.getAllByRole("article")).toHaveLength(2);
      expect(within(lane("Urgent")).getByText("0")).toBeInTheDocument();
      expect(screen.getByText("Showing 2 of 3 active cases")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Filter, 1 in use" })).toHaveAttribute("aria-pressed", "true");
    });

    it("applies with the critical filter", () => {
      showBoard("critical");

      choose("Species", "Cat");

      expect(screen.queryAllByRole("article")).toHaveLength(0);
    });

    it("applies with a search", () => {
      showBoard(undefined, "pip");

      choose("Species", "Cat");

      expect(screen.getAllByRole("article")).toHaveLength(1);
      expect(screen.getByRole("heading", { name: "Pip" })).toBeInTheDocument();
    });

    it("restores every card with Clear filters", () => {
      showBoard();
      choose("Clinician", "unassigned");
      expect(screen.getAllByRole("article")).toHaveLength(1);

      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

      expect(screen.getAllByRole("article")).toHaveLength(3);
      expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("aria-pressed", "false");
    });
  });

  // The Priority button (build plan 2.14d).
  describe("Priority button", () => {
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
      return screen.getByRole("button", { name: "Priority, longest in stage first" });
    }

    function urgentNames() {
      return within(lane("Urgent")).getAllByRole("article").map((card) => within(card).getByRole("heading").textContent);
    }

    it("keeps the API order and is not pressed by default", () => {
      showBoard();

      expect(urgentNames()).toEqual(["Biscuit", "Mochi"]);
      expect(priorityButton()).toHaveAttribute("aria-pressed", "false");
    });

    it("puts the case longest in its stage first when pressed", () => {
      showBoard();

      fireEvent.click(priorityButton());

      expect(urgentNames()).toEqual(["Mochi", "Biscuit"]);
      expect(priorityButton()).toHaveAttribute("aria-pressed", "true");
    });

    it("restores the API order when pressed again", () => {
      showBoard();

      fireEvent.click(priorityButton());
      fireEvent.click(priorityButton());

      expect(urgentNames()).toEqual(["Biscuit", "Mochi"]);
    });

    it("keeps the order with a Filter menu choice, with the counts unchanged", () => {
      showBoard();
      fireEvent.click(priorityButton());
      fireEvent.click(screen.getByRole("button", { name: /^Filter/ }));

      fireEvent.change(screen.getByRole("combobox", { name: "Species" }), { target: { value: "Cat" } });

      expect(urgentNames()).toEqual(["Mochi"]);
      expect(screen.getByText("Showing 2 of 3 active cases")).toBeInTheDocument();
    });

    it("keeps the order with a search", () => {
      showBoard("i");

      fireEvent.click(priorityButton());

      expect(urgentNames()).toEqual(["Mochi", "Biscuit"]);
      expect(within(lane("Urgent")).getByText("2")).toBeInTheDocument();
    });
  });
});
