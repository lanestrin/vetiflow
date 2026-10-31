import { createContext, useContext } from "react";

export interface ClinicalDraft {
  isDirty: () => boolean;
  isSaving: () => boolean;
  confirm: () => Promise<boolean>;
  forceExit: () => void;
}

export interface ClinicalDraftNavigation {
  register: (draft: ClinicalDraft) => () => void;
  hasDraft: () => boolean;
  shouldBlock: () => boolean;
  requestLeave: (action: () => void) => Promise<boolean>;
  forceExit: () => void;
}

export const ClinicalDraftContext = createContext<ClinicalDraftNavigation | null>(null);

const unguarded: ClinicalDraftNavigation = {
  register: () => () => {},
  hasDraft: () => false,
  shouldBlock: () => false,
  requestLeave: async action => { action(); return true; },
  forceExit: () => {}
};

export function useClinicalDraftNavigation() {
  return useContext(ClinicalDraftContext) ?? unguarded;
}
