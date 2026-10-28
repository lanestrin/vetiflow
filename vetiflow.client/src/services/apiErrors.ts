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

// The API refused a form (400): the messages are keyed by field name as the
// API sent them. They name the problem, never the value that was typed.
export class FormRejectedError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(fieldErrors: Record<string, string>) {
    super("The form was not accepted.");
    this.name = "FormRejectedError";
    this.fieldErrors = fieldErrors;
  }
}
