import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildCase } from "../../test/builders";
import { ErBoardStatusBar } from "./ErBoardStatusBar";

function statFor(label: string) {
  const statusBar = screen.getByRole("region", { name: "ER status" });
  return within(statusBar).getByText(label).parentElement;
}

describe("ErBoardStatusBar", () => {
  it("counts patients, critical patients and waiting patients", () => {
    render(
      <ErBoardStatusBar
        cases={[
          buildCase({ acuity: "critical", status: "waiting" }),
          buildCase({ acuity: "critical", status: "inProgress" }),
          buildCase({ acuity: "high", status: "waiting" }),
          buildCase({ acuity: null, status: "assigned" })
        ]}
      />
    );

    expect(statFor("Patients in ER")).toHaveTextContent(/^4\s*Patients in ER$/);
    expect(statFor("Critical")).toHaveTextContent(/^2\s*Critical$/);
    expect(statFor("Waiting")).toHaveTextContent(/^2\s*Waiting$/);
  });

  it("shows zeros for an empty ER", () => {
    render(<ErBoardStatusBar cases={[]} />);

    expect(statFor("Patients in ER")).toHaveTextContent(/^0\s*Patients in ER$/);
    expect(statFor("Critical")).toHaveTextContent(/^0\s*Critical$/);
    expect(statFor("Waiting")).toHaveTextContent(/^0\s*Waiting$/);
  });
});
