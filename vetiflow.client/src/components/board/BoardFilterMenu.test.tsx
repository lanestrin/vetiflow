import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildCase } from "../../test/builders";
import type { EmergencyCaseListItem } from "../../types/EmergencyCaseListItem";
import { BoardFilterMenu } from "./BoardFilterMenu";
import { noMenuFilters, type BoardMenuFilters } from "./boardFormat";

const reed = { id: "staff-reed", name: "Jordan Reed" };
const ames = { id: "staff-ames", name: "Pat Ames" };
const cruz = { id: "staff-cruz", name: "Sam Cruz" };

const boardCases = () => [
  buildCase({ assignedDoctor: reed, assignedTechnician: cruz, species: "Dog", status: "waiting" }),
  buildCase({ assignedDoctor: ames, assignedTechnician: null, species: "Cat", status: "inProgress" }),
  buildCase({ assignedDoctor: reed, assignedTechnician: cruz, species: "Dog", status: "waiting" })
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
    expect(screen.getByRole("combobox", { name: "Staff" })).toBeVisible();

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

  it("lists Acuity, Staff, Species and Case status", () => {
    showMenu();
    fireEvent.click(filterButton());

    expect(screen.getAllByRole("combobox")).toEqual(
      ["Acuity", "Staff", "Species", "Case status"].map((name) => screen.getByRole("combobox", { name })));
    expect(optionLabels("Acuity")).toEqual(["Any acuity", "Critical", "Urgent", "Stable"]);
  });

  it("lists each assigned person once, after the two missing-assignment options", () => {
    showMenu();
    fireEvent.click(filterButton());

    expect(optionLabels("Staff")).toEqual(["Any staff", "No technician assigned", "No veterinarian assigned", "Jordan Reed", "Pat Ames", "Sam Cruz"]);
  });

  it("keeps a chosen person after they leave the board", () => {
    showMenu({ ...noMenuFilters, staff: "staff-gone" }, [buildCase({ assignedDoctor: reed })]);
    fireEvent.click(filterButton());

    expect(screen.getByRole("combobox", { name: "Staff" })).toHaveValue("staff-gone");
    expect(optionLabels("Staff")).toContain("Staff member");
  });

  it("builds each list from the cards on the board, sorted, after the fixed options", () => {
    showMenu();
    fireEvent.click(filterButton());

    expect(optionLabels("Species")).toEqual(["Any species", "Cat", "Dog"]);
    expect(optionLabels("Case status")).toEqual(["Any status", "In progress", "Waiting"]);
  });

  it("keeps a chosen option when no card has it any more", () => {
    showMenu({ ...noMenuFilters, species: "Rabbit", status: "blocked" }, [buildCase({ species: "Dog", status: "waiting" })]);
    fireEvent.click(filterButton());

    expect(screen.getByRole("combobox", { name: "Species" })).toHaveValue("Rabbit");
    expect(optionLabels("Species")).toContain("Rabbit");
    expect(optionLabels("Case status")).toContain("Blocked");
  });

  it("reports each choice, and any to clear one", () => {
    const onChange = showMenu({ ...noMenuFilters, species: "Dog" });
    fireEvent.click(filterButton());

    fireEvent.change(screen.getByRole("combobox", { name: "Staff" }), { target: { value: "staff-reed" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Acuity" }), { target: { value: "urgent" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Species" }), { target: { value: "" } });

    expect(onChange.mock.calls).toEqual([
      [{ acuity: null, staff: "staff-reed", species: "Dog", status: null }],
      [{ acuity: "urgent", staff: null, species: "Dog", status: null }],
      [{ acuity: null, staff: null, species: null, status: null }]
    ]);
  });

  it("counts every filter in use and is pressed while any are", () => {
    showMenu({ acuity: "critical", staff: "no-technician", species: null, status: "waiting" });

    expect(filterButton()).toHaveAccessibleName("Filter, 3 in use");
    expect(filterButton()).toHaveTextContent("⚑ Filter 3");
    expect(filterButton()).toHaveAttribute("aria-pressed", "true");
  });

  it("is not pressed and offers no Clear filters with none in use", () => {
    showMenu();
    fireEvent.click(filterButton());

    expect(filterButton()).toHaveAccessibleName("Filter");
    expect(filterButton()).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("clears every filter with Clear filters", () => {
    const onChange = showMenu({ acuity: "critical", staff: "staff-reed", species: "Dog", status: "waiting" });
    fireEvent.click(filterButton());

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onChange).toHaveBeenCalledWith(noMenuFilters);
  });
});
