import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInScene } from "./SignInScene";

// Narrow screens match "(max-width: 84.99rem)"; everything else is off.
function stubScreen(isNarrow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isNarrow && query.includes("max-width"),
    addEventListener: () => {},
    removeEventListener: () => {}
  }));
}

function renderScene() {
  render(
    <div data-testid="scene">
      <SignInScene />
    </div>
  );
  return screen.getByTestId("scene");
}

describe("SignInScene", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws no photo on narrow screens", () => {
    stubScreen(true);

    expect(renderScene().innerHTML).not.toContain("<image");
  });

  it("draws the photo on wide screens", () => {
    stubScreen(false);

    expect(renderScene().innerHTML).toContain("<image");
  });
});
