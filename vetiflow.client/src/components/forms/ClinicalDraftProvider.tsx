import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useBlocker, useLocation } from "react-router-dom";
import { ClinicalDraftContext, useClinicalDraftNavigation, type ClinicalDraft, type ClinicalDraftNavigation } from "./clinicalDraftContext";

// Kept separate from the provider so isolated form tests can use MemoryRouter.
export function ClinicalDraftRouteBlocker() {
  const navigation = useClinicalDraftNavigation();
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    currentLocation.pathname !== nextLocation.pathname && navigation.shouldBlock());
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    let active = true;
    void navigation.requestLeave(() => { if (active) blocker.proceed(); }).then(left => {
      if (active && !left) blocker.reset();
    });
    return () => { active = false; };
  }, [blocker, navigation]);
  return null;
}

export function ClinicalDraftProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const drafts = useRef(new Set<ClinicalDraft>());
  const forced = useRef(false);
  const pending = useRef(false);
  const navigation = useMemo<ClinicalDraftNavigation>(() => ({
    register(draft) {
      drafts.current.add(draft);
      return () => { drafts.current.delete(draft); };
    },
    hasDraft: () => [...drafts.current].some(draft => draft.isDirty() || draft.isSaving()),
    shouldBlock: () => !forced.current && [...drafts.current].some(draft => draft.isDirty() || draft.isSaving()),
    async requestLeave(action) {
      if (pending.current || [...drafts.current].some(draft => draft.isSaving())) return false;
      pending.current = true;
      try {
        for (const draft of drafts.current) {
          if (!await draft.confirm()) return false;
        }
        if (forced.current) return false;
        action();
        return true;
      } finally { pending.current = false; }
    },
    forceExit() {
      forced.current = true;
      for (const draft of drafts.current) draft.forceExit();
    }
  }), []);

  useEffect(() => { forced.current = false; }, [location.key]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!navigation.shouldBlock()) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [navigation]);

  return <ClinicalDraftContext.Provider value={navigation}>{children}</ClinicalDraftContext.Provider>;
}
