import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FieldError } from "../components/auth/FormMessages";
import type { SignInRouteState } from "../components/auth/experienceHome";
import { SessionBar } from "../components/auth/SessionBar";
import { PatientResults } from "../components/records/PatientResults";
import { AccessDeniedError, SessionEndedError } from "../services/apiErrors";
import { searchPatients } from "../services/recordsApi";
import { clearAccessToken } from "../services/session";
import type { SignedInUser } from "../types/Auth";
import type { PatientListItem } from "../types/PatientListItem";
import styles from "./RecordsPage.module.scss";

interface RecordsPageProps {
  user: SignedInUser;
}

// The API's limits (build plan 4.6a): checking here spares a request.
const minLength = 2;
const maxLength = 100;
const maxResults = 25;
const searchError = "Enter 2 to 100 characters to search.";

// What a finished search found. `forSearch` ties it to the search that asked,
// so a result never shows under a newer search.
type SearchResult =
  | { forSearch: string; kind: "found"; patients: PatientListItem[] }
  | { forSearch: string; kind: "failed" };

function isValidSearch(text: string): boolean {
  return text.length >= minLength && text.length <= maxLength;
}

function foundMessage(text: string, count: number): string {
  if (count === 0) {
    return `No patients match “${text}”.`;
  }

  if (count >= maxResults) {
    return `Showing the first ${maxResults} matches. Add more of the name to narrow the search.`;
  }

  return count === 1 ? "1 patient found" : `${count} patients found`;
}

// Patient records search for hospital team members (build plan 4.6b). The
// search text lives in the URL, so reloading or going back shows the same
// results. RequireExperience lets only team members in; the API's 401 and 403
// are the real check.
export function RecordsPage({ user }: RecordsPageProps) {
  const id = useId();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get("search")?.trim() ?? null;
  const [draft, setDraft] = useState(urlSearch ?? "");
  const [shownSearch, setShownSearch] = useState(urlSearch);
  // Pressing Search again for the same text runs it again (after an error).
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);

  const hasValidSearch = urlSearch !== null && isValidSearch(urlSearch);
  const showFieldError = urlSearch !== null && !hasValidSearch;
  const searchKey = hasValidSearch ? `${urlSearch}#${attempt}` : null;
  const errorId = `${id}-error`;

  // The back button changes the URL: the field follows it.
  if (urlSearch !== shownSearch) {
    setShownSearch(urlSearch);
    setDraft(urlSearch ?? "");
  }

  useEffect(() => {
    if (searchKey === null || urlSearch === null) {
      return;
    }

    // A newer search, or leaving the page, cancels this one.
    const controller = new AbortController();

    searchPatients(urlSearch, controller.signal)
      .then((patients) => {
        setResult({ forSearch: searchKey, kind: "found", patients });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof SessionEndedError) {
          clearAccessToken();
          navigate("/sign-in", { replace: true, state: { sessionEnded: true } satisfies SignInRouteState });
        } else if (error instanceof AccessDeniedError) {
          navigate("/pet-parent", { replace: true });
        } else {
          setResult({ forSearch: searchKey, kind: "failed" });
        }
      });

    return () => controller.abort();
  }, [searchKey, urlSearch, navigate]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();

    // An invalid search goes in the URL too, which shows the field error and
    // sends nothing.
    setSearchParams({ search: text });
    setAttempt((current) => current + 1);

    if (!isValidSearch(text)) {
      inputRef.current?.focus();
    }
  }

  const currentResult = result !== null && result.forSearch === searchKey ? result : null;

  function statusText(): string {
    if (!hasValidSearch || urlSearch === null) {
      return "";
    }

    if (currentResult === null) {
      return "Searching…";
    }

    if (currentResult.kind === "failed") {
      return "Patient search isn't available right now. Try again in a moment.";
    }

    return foundMessage(urlSearch, currentResult.patients.length);
  }

  return (
    <main className={styles.page}>
      <title>Patient records · VetiFlow</title>
      <header className={styles.header}>
        <h1 className={styles.title}>Patient records</h1>
        <Link className={styles.backLink} to="/er">Back to board</Link>
        <SessionBar user={user} />
      </header>

      <form className={styles.search} onSubmit={handleSubmit} role="search" noValidate>
        <label className={styles.label} htmlFor={`${id}-search`}>Pet or owner name</label>
        <div className={styles.searchRow}>
          <input
            id={`${id}-search`}
            ref={inputRef}
            className={styles.input}
            type="search"
            autoComplete="off"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-invalid={showFieldError ? true : undefined}
            aria-describedby={showFieldError ? errorId : undefined}
          />
          <button type="submit" className={styles.button}>Search</button>
        </div>
        {showFieldError && <FieldError id={errorId} text={searchError} />}
      </form>

      <section className={styles.results} aria-label="Search results">
        {urlSearch === null && (
          <p className={styles.prompt}>Search by the pet's name or the owner's name.</p>
        )}

        <p className={styles.status} role="status" aria-live="polite">{statusText()}</p>

        {currentResult?.kind === "found" && currentResult.patients.length > 0 && (
          <PatientResults patients={currentResult.patients} />
        )}
      </section>
    </main>
  );
}
