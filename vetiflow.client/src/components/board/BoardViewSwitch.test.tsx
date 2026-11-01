import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardViewSwitch } from "./BoardViewSwitch";

describe("BoardViewSwitch", () => {
  it("shows the ER board as the selected view", () => {
    render(<BoardViewSwitch />);

    const tablist = screen.getByRole("tablist", { name: "Dashboard view" });
    expect(within(tablist).getByRole("tab", { name: "ER board" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows My patients as disabled and coming soon", () => {
    render(<BoardViewSwitch />);

    const myPatients = screen.getByRole("tab", { name: "My patients" });
    expect(myPatients).toBeDisabled();
    expect(myPatients).toHaveAttribute("aria-selected", "false");
    expect(myPatients).toHaveAttribute("title", "Coming soon");
  });

  it("shows the shared record hint", () => {
    render(<BoardViewSwitch />);

    expect(screen.getByText("Shared patient record · role-focused workspace")).toBeInTheDocument();
  });
});
