import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { EmergencyBar } from "./EmergencyBar";

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

describe("EmergencyBar", () => {
  it("asks if the visitor needs emergency care", () => {
    render(<EmergencyBar />);

    const bar = screen.getByRole("complementary", { name: "Emergency veterinary care" });
    expect(within(bar).getByRole("heading", { name: "Need emergency care?" })).toBeInTheDocument();
    expect(bar).toHaveTextContent("For life-threatening emergencies, call your hospital directly.");
  });

  it("explains that Call Now can't dial in the demo", () => {
    render(<EmergencyBar />);

    fireEvent.click(screen.getByRole("button", { name: "Call Now" }));

    const notice = screen.getByRole("dialog", { name: "Demo: no hospital is set up" });
    expect(notice).toHaveTextContent("so Call Now can't dial a number");
    expect(notice).toHaveTextContent("call your local emergency vet");

    fireEvent.click(within(notice).getByRole("button", { name: "OK" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explains that View Directions can't open a map in the demo", () => {
    render(<EmergencyBar />);

    fireEvent.click(screen.getByRole("button", { name: "View Directions" }));

    expect(screen.getByRole("dialog", { name: "Demo: no hospital is set up" })).toHaveTextContent(
      "so View Directions can't open a map"
    );
  });

  it("never links to a phone number or a map", () => {
    render(<EmergencyBar />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
