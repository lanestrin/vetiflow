import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignInBenefits, SignInBrand, SignInStory } from "./SignInStory";

describe("SignInStory", () => {
  it("names the brand, with the paw hidden from screen readers", () => {
    render(<SignInBrand />);

    expect(screen.getByText("VetiFlow")).toBeInTheDocument();
    expect(screen.getByText("Veterinary care. In sync.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("tells the story in words", () => {
    render(<SignInStory />);

    const story = screen.getByRole("region", { name: "About VetiFlow" });
    expect(story).toHaveTextContent("Care, connected");
    expect(story).toHaveTextContent("Care moves fast.Stay in sync.");
    expect(story).toHaveTextContent(
      "A clearer connection between veterinary teams and the people who love their pets."
    );
  });

  it("lists the three benefits, with icons hidden from screen readers", () => {
    render(<SignInBenefits />);

    const list = screen.getByRole("list", { name: "VetiFlow benefits" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Care updates, all in one placeYour hospital team is here when you need them.",
      "Less phone tagSecure messaging and real-time updates.",
      "A more connected care experienceFor healthier, happier pets."
    ]);
    expect(within(list).queryAllByRole("img")).toHaveLength(0);
  });
});
