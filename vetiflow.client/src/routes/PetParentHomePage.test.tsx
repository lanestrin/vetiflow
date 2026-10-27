import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PetParentHomePage } from "./PetParentHomePage";

describe("PetParentHomePage", () => {
  it("welcomes the signed-in pet parent by name, with the session bar", () => {
    render(
      <MemoryRouter>
        <PetParentHomePage user={{ name: "Morgan Hale", experience: "petParent" }} />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome back, Morgan Hale" })
    ).toBeInTheDocument();
    expect(screen.getByText("Your pet's care updates will appear here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(document.title).toBe("Welcome · VetiFlow");
  });
});
