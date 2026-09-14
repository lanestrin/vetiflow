import {
  HubConnection,
  HubConnectionBuilder,
} from "@microsoft/signalr";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export function createCaseHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${apiBaseUrl}/hubs/cases`)
    .withAutomaticReconnect()
    .build();
}