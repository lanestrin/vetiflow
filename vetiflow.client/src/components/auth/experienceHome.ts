import type { Experience } from "../../types/Auth";

// Where each experience lands after sign-in and when it opens "/".
export const experienceHome: Record<Experience, string> = {
  teamMember: "/er",
  petParent: "/pet-parent"
};

// Router state that tells the sign-in page why the person is back.
export interface SignInRouteState {
  sessionEnded?: boolean;
}
