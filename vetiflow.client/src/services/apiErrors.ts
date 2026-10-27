// The API refused the session (401): the token expired or was never valid.
export class SessionEndedError extends Error {
  constructor() {
    super("The session has ended.");
    this.name = "SessionEndedError";
  }
}

// The API refused this account (403): it may not use what was asked for.
export class AccessDeniedError extends Error {
  constructor() {
    super("This account can't use that.");
    this.name = "AccessDeniedError";
  }
}
