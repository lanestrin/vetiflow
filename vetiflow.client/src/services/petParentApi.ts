import type { PetSummary } from "../types/PetSummary";
import { SessionEndedError } from "./apiErrors";
import { readAccessToken } from "./session";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

// The signed-in pet parent's own pets; the server finds the owner from the token.
export async function getMyPets(): Promise<PetSummary[]> {
  const accessToken = readAccessToken();
  const response = await fetch(`${apiBaseUrl}/api/pet-parent/pets`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  });

  if (response.status === 401) {
    throw new SessionEndedError();
  }

  if (!response.ok) {
    throw new Error("Failed to load your pets.");
  }

  return response.json();
}
