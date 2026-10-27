// One of the signed-in pet parent's own pets (GET /api/pet-parent/pets).
export interface PetSummary {
  name: string;
  species: string;
  inCare: boolean;
}
