import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ClinicalDraftContext, type ClinicalDraft } from "./clinicalDraftContext";
import { DiscardChangesDialog } from "./DiscardChangesDialog";

function values(form: HTMLFormElement | null) {
  return JSON.stringify(Array.from(form?.elements ?? []).flatMap(element => {
    if (element instanceof HTMLInputElement) {
      if (["submit", "button", "hidden"].includes(element.type)) return [];
      return [[element.name || element.id, element.type === "radio" || element.type === "checkbox" ? element.checked : element.value]];
    }
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return [[element.name || element.id, element.value]];
    return [];
  }));
}

export function useClinicalDraft(dialog: RefObject<HTMLDialogElement | null>, form: RefObject<HTMLFormElement | null>) {
  const navigation = useContext(ClinicalDraftContext);
  const baseline = useRef("");
  const dirty = useRef(false);
  const saving = useRef(false);
  const active = useRef(false);
  const forced = useRef(false);
  const focus = useRef<HTMLElement | null>(null);
  const answer = useRef<((discard: boolean) => void) | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [exited, setExited] = useState(false);

  const finishConfirmation = useCallback((discard: boolean) => {
    const resolve = answer.current;
    answer.current = null;
    if (discard) dirty.current = false;
    setConfirming(false);
    if (!discard && active.current && !forced.current) focus.current?.focus();
    resolve?.(discard);
  }, []);

  const guard = useMemo<ClinicalDraft>(() => ({
    isDirty: () => dirty.current,
    isSaving: () => saving.current,
    confirm() {
      if (saving.current || forced.current || answer.current) return Promise.resolve(false);
      if (!dirty.current) return Promise.resolve(true);
      setConfirming(true);
      return new Promise<boolean>(resolve => { answer.current = resolve; });
    },
    forceExit() {
      forced.current = true;
      dirty.current = false;
      saving.current = false;
      active.current = false;
      answer.current?.(false);
      answer.current = null;
      setConfirming(false);
      setExited(true);
    }
  }), []);

  useLayoutEffect(() => {
    baseline.current = values(form.current);
    active.current = true;
    return () => {
      active.current = false;
      answer.current?.(false);
      answer.current = null;
    };
  }, [form]);
  useEffect(() => navigation?.register(guard), [navigation, guard]);
  useEffect(() => {
    if (navigation) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty.current && !saving.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [navigation]);

  return {
    exited,
    confirmation: confirming ? <DiscardChangesDialog onAnswer={finishConfirmation} /> : null,
    formProps: {
      onChange: (event: React.FormEvent<HTMLFormElement>) => {
        dirty.current = values(form.current) !== baseline.current;
        if (event.target instanceof HTMLElement) focus.current = event.target;
      },
      onFocusCapture: (event: React.FocusEvent<HTMLFormElement>) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) {
          focus.current = event.target;
        }
      }
    },
    dismiss: () => {
      // Clean closes remain synchronous, including native Escape.
      if (saving.current || forced.current) return;
      if (!dirty.current) { dialog.current?.close(); return; }
      void guard.confirm().then(discard => { if (discard && active.current) dialog.current?.close(); });
    },
    isActive: () => active.current && !forced.current,
    isSaving: guard.isSaving,
    startSaving: () => {
      if (saving.current || forced.current || answer.current) return false;
      saving.current = true;
      return true;
    },
    finishSaving: () => { saving.current = false; },
    saved: () => { dirty.current = false; }
  };
}
