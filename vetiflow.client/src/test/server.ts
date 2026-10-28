import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export function apiUrl(path: string): string {
  return `${import.meta.env.VITE_API_BASE_URL}${path}`;
}

// Defaults for every test; override per test with server.use(...).
export const server = setupServer(
  http.get(apiUrl("/api/cases"), () => HttpResponse.json([])),
  http.get(apiUrl("/api/pet-parent/pets"), () => HttpResponse.json([])),
  http.get(apiUrl("/api/patients"), () => HttpResponse.json([]))
);
