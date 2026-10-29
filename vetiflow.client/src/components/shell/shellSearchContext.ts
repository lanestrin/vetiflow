import { createContext, useContext } from "react";

// What is typed in the top bar's "Search patients…", for the page below it
// (the board filters its cards as you type, build plan 2.14a). Outside the
// shell there is no search.
export const ShellSearchContext = createContext("");

export function useShellSearch(): string {
  return useContext(ShellSearchContext);
}
