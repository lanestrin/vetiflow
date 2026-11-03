import { createContext, useContext } from "react";

// What is typed in the top bar's "Search patients…", for the page below it
// (the board filters as you type, build plan 2.14a), with its setter so the
// board's own search box stays in step (2.26b). Null outside the shell.
export type ShellSearch = [search: string, setSearch: (search: string) => void];

export const ShellSearchContext = createContext<ShellSearch | null>(null);

export function useShellSearch(): ShellSearch | null {
  return useContext(ShellSearchContext);
}
