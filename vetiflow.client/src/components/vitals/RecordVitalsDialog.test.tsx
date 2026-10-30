import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildCaseDetail, buildVitalsRecord } from "../../test/builders";
import type { CaseDetail } from "../../types/CaseDetail";
import { apiUrl, server } from "../../test/server";
import { readAccessToken, saveAccessToken } from "../../services/session";
import * as casesApi from "../../services/casesApi";
import { RecordVitalsDialog } from "./RecordVitalsDialog";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(() => sessionStorage.clear());

const path = apiUrl("/api/cases/case-42/vitals");
const heart = () => screen.getByLabelText("Heart rate (bpm)");
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save vitals" }));
function enter(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }

function renderDialog(overrides: Partial<CaseDetail> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const onUnavailable = vi.fn();
  const detail = buildCaseDetail({ id: "case-42", caseNumber: "ER-42", ...overrides });
  const view = render(<MemoryRouter><Routes>
    <Route path="/" element={<RecordVitalsDialog detail={detail} onClose={onClose} onSaved={onSaved} onUnavailable={onUnavailable} />} />
    <Route path="/sign-in" element={<p>Sign-in page</p>} />
    <Route path="/pet-parent" element={<p>Pet parent home</p>} />
  </Routes></MemoryRouter>);
  return { ...view, onClose, onSaved, onUnavailable };
}
function serve(status = 201, body?: unknown) {
  const sent: unknown[] = [];
  server.use(http.post(path, async ({ request }) => {
    sent.push(await request.json());
    return body === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(body, { status });
  }));
  return sent;
}
function deferredWrite() {
  let resolve!: (response: Response) => void;
  const response = new Promise<Response>(done => { resolve = done; });
  const sent: unknown[] = [];
  server.use(http.post(path, async ({ request }) => { sent.push(await request.json()); return response; }));
  return { sent, finish: (status = 201) => resolve(new HttpResponse(null, { status })) };
}

describe("RecordVitalsDialog", () => {
  it("prefills all seven latest values and records the full unchanged reviewed set", async () => {
    const sent = serve();
    const latest = buildVitalsRecord({ heartRate: 125, respiratoryRate: 28, temperatureF: 102, spO2: 97,
      mucousMembraneColor: "Pink", capillaryRefillTime: "2 s", mentation: "Alert" });
    const { onSaved } = renderDialog({ vitals: [latest] });
    expect(screen.getAllByRole("textbox").map(input => (input as HTMLInputElement).value)).toEqual([
      "125", "28", "38.9", "97", "Pink", "2 s", "Alert"
    ]);
    expect(screen.getByText(/saving records the full form as a new set/i)).toBeInTheDocument();
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(sent).toEqual([{ heartRate: 125, respiratoryRate: 28, temperatureF: 102, spO2: 97,
      mucousMembraneColor: "Pink", capillaryRefillTime: "2 s", mentation: "Alert" }]);
  });

  it.each([80, 101.5, 103.1, 115])("preserves an unchanged %s F reading without round-trip drift", async temperatureF => {
    const sent = serve();
    const { onSaved } = renderDialog({ vitals: [buildVitalsRecord({ temperatureF })] });
    expect(screen.getByLabelText("Temperature (°C)")).toHaveValue(((temperatureF - 32) * 5 / 9).toFixed(1));
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(sent).toEqual([{ temperatureF }]);
  });

  it("converts a changed prefilled temperature while retaining other reviewed values", async () => {
    const sent = serve();
    const { onSaved } = renderDialog({ vitals: [buildVitalsRecord({ heartRate: 125, temperatureF: 80 })] });
    enter("Temperature (°C)", "38.9");
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(sent).toEqual([{ heartRate: 125, temperatureF: 102 }]);
  });

  it("leaves missing latest values blank without borrowing from an older set", () => {
    renderDialog({ vitals: [buildVitalsRecord({ mentation: "Alert" }), buildVitalsRecord({ heartRate: 125, temperatureF: 102 })] });
    expect(heart()).toHaveValue("");
    expect(screen.getByLabelText("Temperature (°C)")).toHaveValue("");
    expect(screen.getByLabelText("Mentation")).toHaveValue("Alert");
  });

  it("omits cleared prefilled readings and observations from the new set", async () => {
    const sent = serve();
    const { onSaved } = renderDialog({ vitals: [buildVitalsRecord({ heartRate: 125, temperatureF: 102, mentation: "Alert" })] });
    enter("Temperature (°C)", "");
    enter("Mentation", "   ");
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(sent).toEqual([{ heartRate: 125 }]);
  });

  it("rejects a reviewed set after every prefilled value is cleared", () => {
    const sent = serve();
    renderDialog({ vitals: [buildVitalsRecord({ heartRate: 125, mentation: "Alert" })] });
    enter("Heart rate (bpm)", "");
    enter("Mentation", "");
    save();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter at least one reading or observation.");
    expect(sent).toEqual([]);
  });

  it("retains the draft on backdrop and empty-space clicks", () => {
    const sent = serve();
    const { onClose } = renderDialog();
    enter("Heart rate (bpm)", "90");
    fireEvent.click(screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("heading", { name: "Record vitals" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(heart()).toHaveValue("90");
    expect(onClose).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("focuses a server-invalid field after pending inputs are re-enabled", async () => {
    serve(400, { errors: { Mentation: ["Check this observation."] } });
    renderDialog({ vitals: [buildVitalsRecord({ heartRate: 125 })] });
    save();
    await screen.findByText("Check this observation.");
    expect(screen.getByLabelText("Mentation")).toBeEnabled();
    await waitFor(() => expect(screen.getByLabelText("Mentation")).toHaveFocus());
  });

  it("opens a blank set for the named case with focus on heart rate", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Record vitals" })).toBeVisible();
    expect(screen.getByText(/Case ER-42/)).toBeInTheDocument();
    expect(heart()).toHaveFocus();
    expect(screen.getAllByRole("textbox")).toHaveLength(7);
    for (const input of screen.getAllByRole("textbox")) expect(input).toHaveValue("");
  });

  it("requires a reading or nonblank observation without sending a request", () => {
    const sent = serve();
    renderDialog();
    enter("Mentation", "   ");
    save();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter at least one reading or observation.");
    expect(heart()).toHaveFocus();
    expect(sent).toEqual([]);
  });

  it("converts Celsius, trims observations and posts only the newly entered set", async () => {
    const sent = serve();
    const { onSaved } = renderDialog();
    enter("Heart rate (bpm)", "125");
    enter("Respiratory rate (/min)", "28");
    enter("Temperature (°C)", "38.9");
    enter("SpO₂ (%)", "97");
    enter("Mucous membrane colour", " Pink ");
    enter("Capillary refill time", " 2 s ");
    enter("Mentation", " Alert ");
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(sent).toEqual([{ heartRate: 125, respiratoryRate: 28, temperatureF: 102, spO2: 97,
      mucousMembraneColor: "Pink", capillaryRefillTime: "2 s", mentation: "Alert" }]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["SpO₂ (%)", "98", { spO2: 98 }],
    ["Mentation", " Bright ", { mentation: "Bright" }],
    ["Mucous membrane colour", "x".repeat(50), { mucousMembraneColor: "x".repeat(50) }],
    ["Capillary refill time", " 2 s ", { capillaryRefillTime: "2 s" }],
    ["Temperature (°C)", "26.7", { temperatureF: 80.1 }],
    ["Temperature (°C)", "46.1", { temperatureF: 115 }],
    ["Heart rate (bpm)", "1", { heartRate: 1 }],
    ["Heart rate (bpm)", "400", { heartRate: 400 }],
    ["Respiratory rate (/min)", "1", { respiratoryRate: 1 }],
    ["Respiratory rate (/min)", "200", { respiratoryRate: 200 }],
    ["SpO₂ (%)", "50", { spO2: 50 }],
    ["SpO₂ (%)", "100", { spO2: 100 }]
  ])("accepts a partial set with %s = %s", async (label, value, payload) => {
    const sent = serve();
    const { onSaved } = renderDialog();
    enter(label, value);
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(sent).toEqual([payload]);
  });

  it.each([
    ["Heart rate (bpm)", "0"], ["Heart rate (bpm)", "401"], ["Heart rate (bpm)", "90.5"],
    ["Heart rate (bpm)", "NaN"], ["Heart rate (bpm)", "Infinity"], ["Heart rate (bpm)", "1e309"],
    ["Respiratory rate (/min)", "0"], ["Respiratory rate (/min)", "201"], ["Respiratory rate (/min)", "24.5"],
    ["SpO₂ (%)", "49"], ["SpO₂ (%)", "101"], ["SpO₂ (%)", "97.5"],
    ["Temperature (°C)", "26.6"], ["Temperature (°C)", "46.2"], ["Temperature (°C)", "38.95"],
    ["Temperature (°C)", "not a temperature"],
    ["Mucous membrane colour", "x".repeat(51)], ["Capillary refill time", "x".repeat(51)], ["Mentation", "x".repeat(51)]
  ])("rejects invalid %s = %s and focuses its associated error", (label, value) => {
    const sent = serve();
    renderDialog();
    enter(label, value);
    save();
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription();
    expect(input).toHaveFocus();
    expect(sent).toEqual([]);
  });

  it("keeps input and maps validation field casing and JSON keys, including Fahrenheit to Celsius", async () => {
    serve(400, { errors: {
      "$.HeartRate": ["Heart rate was refused."], respiratoryRate: ["Respiratory rate was refused."],
      TemperatureF: ["Temperature must be between 80 and 115."], SpO2: ["SpO2 was refused."],
      MucousMembraneColor: ["Colour was refused."], capillaryRefillTime: ["Refill time was refused."], Mentation: ["Mentation was refused."]
    } });
    const { onSaved } = renderDialog();
    enter("Heart rate (bpm)", "90");
    enter("Temperature (°C)", "38.9");
    save();
    expect(await screen.findByText("Heart rate was refused.")).toBeInTheDocument();
    expect(screen.getByLabelText("Temperature (°C)")).toHaveAccessibleDescription(/26.7 to 46.1 °C/);
    expect(screen.queryByText("Temperature must be between 80 and 115.")).not.toBeInTheDocument();
    for (const input of screen.getAllByRole("textbox")) expect(input).toHaveAttribute("aria-invalid", "true");
    expect(heart()).toHaveValue("90");
    expect(heart()).toHaveFocus();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("maps the API Readings error to the form", async () => {
    serve(400, { errors: { Readings: ["Record at least one reading or observation."] } });
    renderDialog();
    enter("SpO₂ (%)", "98");
    save();
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter at least one reading or observation.");
    expect(screen.getByLabelText("SpO₂ (%)")).toHaveValue("98");
  });

  it.each([400, 500, "network"])("retains the draft and allows manual retry after %s", async status => {
    const sent = status === "network" ? [] : serve(status as number);
    if (status === "network") server.use(http.post(path, () => HttpResponse.error()));
    const { onSaved } = renderDialog();
    enter("Heart rate (bpm)", "90");
    save();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save vitals. Try again.");
    expect(heart()).toHaveValue("90");
    expect(screen.getByRole("button", { name: "Save vitals" })).toBeEnabled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(sent).toHaveLength(status === "network" ? 0 : 1);
    const retry = serve();
    save();
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(retry).toEqual([{ heartRate: 90 }]);
  });

  it.each([[404, "This case is no longer on the board."], [409, "This case has been discharged."]])(
    "refreshes but prevents another save when the API returns %s", async (status, message) => {
      const sent = serve(status as number);
      const { onUnavailable, onSaved } = renderDialog();
      enter("Heart rate (bpm)", "90");
      save();
      expect(await screen.findByRole("alert")).toHaveTextContent(message as string);
      expect(onUnavailable).toHaveBeenCalledOnce();
      expect(onSaved).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Save vitals" })).toBeDisabled();
      fireEvent.submit(screen.getByRole("form"));
      expect(sent).toHaveLength(1);
    });

  it.each([[401, "Sign-in page"], [403, "Pet parent home"]])("leaves on refusal %s", async (status, page) => {
    serve(status as number);
    saveAccessToken("expired-or-denied");
    const { onSaved } = renderDialog();
    enter("Heart rate (bpm)", "90");
    save();
    expect(await screen.findByText(page as string)).toBeInTheDocument();
    expect(readAccessToken()).toBe(status === 401 ? null : "expired-or-denied");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it.each(["Cancel", "Close record vitals", "Escape"])("dismisses through %s without saving", method => {
    const sent = serve();
    const { onClose, onSaved } = renderDialog();
    enter("Heart rate (bpm)", "90");
    if (method === "Escape") fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    else fireEvent.click(screen.getByRole("button", { name: method }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("prevents duplicate submits and every dismissal while a save is pending", async () => {
    const write = deferredWrite();
    const { onClose, onSaved } = renderDialog();
    enter("Heart rate (bpm)", "90");
    save();
    const form = screen.getByRole("form");
    fireEvent.submit(form);
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close record vitals" })).toBeDisabled();
    for (const input of screen.getAllByRole("textbox")) expect(input).toBeDisabled();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(write.sent).toHaveLength(1));
    await act(async () => { write.finish(); });
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([201, 401, 404, 409, 500])("ignores a save completing with %s after unmount", async status => {
    const write = deferredWrite();
    const request = vi.spyOn(casesApi, "recordVitals");
    const { unmount, onSaved, onClose, onUnavailable } = renderDialog();
    enter("Heart rate (bpm)", "90");
    save();
    await waitFor(() => expect(write.sent).toHaveLength(1));
    unmount();
    await act(async () => {
      write.finish(status);
      await request.mock.results[0].value.catch(() => {});
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onUnavailable).not.toHaveBeenCalled();
  });
});
