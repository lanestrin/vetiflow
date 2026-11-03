import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoRoleProvider } from "./DemoRoleProvider";
import { useDemoRole } from "./demoRoleContext";

function RoleProbe() {
  const [role, setRole] = useDemoRole();
  return <button type="button" onClick={() => setRole(role === "technician" ? "veterinarian" : "technician")}>{role}</button>;
}

function renderProbe() {
  const view = render(<DemoRoleProvider><RoleProbe /></DemoRoleProvider>);
  return { probe: screen.getByRole("button"), unmount: view.unmount };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

// The Demo role switch's state (2.28): remembered per browser, never a
// security control.
describe("DemoRoleProvider", () => {
  it("starts as Veterinarian", () => {
    expect(renderProbe().probe).toHaveTextContent("veterinarian");
  });

  it("remembers the chosen role", () => {
    const view = renderProbe();
    fireEvent.click(view.probe);
    view.unmount();

    expect(localStorage.getItem("vetiflow.demoRole")).toBe("technician");
    expect(renderProbe().probe).toHaveTextContent("technician");
  });

  it.each([
    ["holds an unknown value", () => localStorage.setItem("vetiflow.demoRole", "admin")],
    ["is unreadable", () => vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); })]
  ])("falls back to Veterinarian when storage %s", (_reason, arrange) => {
    arrange();

    expect(renderProbe().probe).toHaveTextContent("veterinarian");
  });

  it("still switches when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    const { probe } = renderProbe();

    fireEvent.click(probe);

    expect(probe).toHaveTextContent("technician");
  });
});
