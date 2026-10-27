import type { Experience } from "../../types/Auth";

// Display labels for each experience live in the client, not the API.
export const experienceLabels: Record<Experience, string> = {
  teamMember: "Hospital team member",
  petParent: "Pet parent"
};
