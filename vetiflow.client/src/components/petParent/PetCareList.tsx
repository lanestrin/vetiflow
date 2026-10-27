import type { PetSummary } from "../../types/PetSummary";
import styles from "./PetCareList.module.scss";

interface PetCareListProps {
  pets: PetSummary[];
}

// Calm, plain words for owners: no acuity, no clinical terms. In-care shows by
// an icon and its own words, never by colour alone.
export function PetCareList({ pets }: PetCareListProps) {
  return (
    <ul className={styles.list}>
      {pets.map((pet) => (
        <li key={`${pet.name}-${pet.species}`} className={styles.pet}>
          <span className={styles.name}>{pet.name}</span>
          <span className={styles.species}>{pet.species}</span>
          {pet.inCare ? (
            <span className={styles.inCare}>
              <span aria-hidden="true">♥</span> In our care
            </span>
          ) : (
            <span className={styles.notInCare}>Not with us right now</span>
          )}
        </li>
      ))}
    </ul>
  );
}
