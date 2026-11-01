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

// The case a write was for is gone from the board: no case has that id (404)
// or it has been discharged (409).
export class CaseGoneError extends Error {
  readonly reason: "notFound" | "discharged";

  constructor(reason: "notFound" | "discharged") {
    super(reason === "notFound" ? "The case was not found." : "The case has been discharged.");
    this.name = "CaseGoneError";
    this.reason = reason;
  }
}

// The API refused a change (409): a stage or status move, or a tag over the
// limit. The reason is the server's clinician-facing wording, such as "A case
// in Triage cannot move to Incoming.", so it can be shown as it is.
export class ChangeRefusedError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "ChangeRefusedError";
    this.reason = reason;
  }
}
