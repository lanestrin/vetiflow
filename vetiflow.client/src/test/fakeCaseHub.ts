import type { HubConnection } from "@microsoft/signalr";
import { vi } from "vitest";

// Stands in for the SignalR connection so tests can push server events
// without a running hub.
export function createFakeCaseHub() {
  const handlers = new Map<string, (...args: unknown[]) => void>();

  const connection = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
    }),
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve())
  };

  return {
    connection,
    asHubConnection: () => connection as unknown as HubConnection,
    emit: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
    isListening: (event: string) => handlers.has(event)
  };
}
