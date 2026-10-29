import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildCase } from "../../test/builders";
import type { EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import { BoardFilterMenu } from "./BoardFilterMenu";
import { noMenuFilters, type BoardMenuFilters } from "./boardFormat";

const reed = { id: "staff-reed", shortName: "Reed", initials: "JR" };
const ames = { id: "staff-ames", shortName: "Ames", initials: "PA" };

const boardCases = () => [
  buildCase({ clinician: reed, species: "Dog", status: "waiting" }),
  buildCase({ clinician: ames, species: "Cat", status: "inProgress" }),
  buildCase({ clinician: reed, species: "Dog", status: "waiting" })
];

function showMenu(filters: BoardMenuFilters = noMenuFilters, cases: EmergencyCaseListItem[] = boardCases()) {
  const onChange = vi.fn();
  render(<BoardFilterMenu cases={cases} filters={filters} onChange={onChange} />);
  return onChange;
}

function filterButton() {
  return screen.getByRole("button", { name: /^Filter/ });
}

function optionLabels(name: string) {
  return within(screen.getByRole("combobox", { name })).getAllByRole("option").map((option) => option.textContent);
}

describe("BoardFilterMenu", () => {
  it("opens from the button and closes with Escape, returning focus", () => {
    showMenu();

    fireEvent.click(filterButton());

    expect(filterButton()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("combobox", { name: "Clinician" })).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(filterButton()).toHaveAttribute("aria-expanded", "false");
    expect(filterButton()).toHaveFocus();
  });

  it("closes on a press outside", () => {
    showMenu();
    fireEvent.click(filterButton());

    fireEvent.pointerDown(document.body);

    expect(filterButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("builds each list from the cards on the board, sorted, after the fixed options", () => {
    showMenu();
    fireEvent.click(filterButton());

    expect(optionLabels("Clinician")).toEqual(["Any clinician", "Unassigned", "Ames", "Reed"]);
    expect(optionLabels("Species")).toEqual(["Any species", "Cat", "Dog"]);
    expect(optionLabels("Case status")).toEqual(["Any status", "In progress", "Waiting"]);
  });

  it("keeps a chosen option when no card has it any more", () => {
    showMenu({ clinicianId: null, species: "Rabbit", status: "blocked" }, [buildCase({ species: "Dog", status: "waiting" })]);
    fireEvent.click(filterButton());

    expect(screen.getByRole("combobox", { name: "Species" })).toHaveValue("Rabbit");
    expect(optionLabels("Species")).toContain("Rabbit");
    expect(optionLabels("Case status")).toContain("Blocked");
  });

  it("reports each choice, and any to clear one", () => {
    const onChange = showMenu({ ...noMenuFilters, species: "Dog" });
    fireEvent.click(filterButton());

    fireEvent.change(screen.getByRole("combobox", { name: "Clinician" }), { target: { value: "staff-reed" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Species" }), { target: { value: "" } });

    expect(onChange.mock.calls).toEqual([
      [{ clinicianId: "staff-reed", species: "Dog", status: null }],
      [{ clinicianId: null, species: null, status: null }]
    ]);
  });

  it("shows how many filters are in use and is pressed while any are", () => {
    showMenu({ clinicianId: "unassigned", species: null, status: "waiting" });

    expect(filterButton()).toHaveAccessibleName("Filter, 2 in use");
    expect(filterButton()).toHaveTextContent("⚑ Filter 2");
    expect(filterButton()).toHaveAttribute("aria-pressed", "true");
  });

  it("is not pressed and offers no Clear filters with none in use", () => {
    showMenu();
    fireEvent.click(filterButton());

    expect(filterButton()).toHaveAccessibleName("Filter");
    expect(filterButton()).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("clears all three with Clear filters", () => {
    const onChange = showMenu({ clinicianId: "staff-reed", species: "Dog", status: "waiting" });
    fireEvent.click(filterButton());

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onChange).toHaveBeenCalledWith(noMenuFilters);
  });
});
