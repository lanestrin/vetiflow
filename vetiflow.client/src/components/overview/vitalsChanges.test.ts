import { describe, expect, it } from "vitest";
import { buildVitalsRecord } from "../../test/builders";
import { vitalsChanges } from "./vitalsChanges";

describe("vitalsChanges", () => {
  it("lists changed readings from the previous value to the new one, in the drawer's order", () => {
    const previous = buildVitalsRecord({ heartRate: 160, spO2: 92, mentation: "Dull" });
    const current = buildVitalsRecord({ heartRate: 148, spO2: 97, mentation: "Alert" });

    expect(vitalsChanges(current, previous).changed).toEqual([
      { label: "Heart rate", from: "160 bpm", to: "148 bpm" },
      { label: "SpO₂", from: "92%", to: "97%" },
      { label: "Mentation", from: "Dull", to: "Alert" }
    ]);
  });

  it("keeps newly recorded and no-longer-recorded readings apart from unchanged ones", () => {
    const previous = buildVitalsRecord({ respiratoryRate: 48, temperatureF: 103 });
    const current = buildVitalsRecord({ respiratoryRate: 48, spO2: 97 });

    const changes = vitalsChanges(current, previous);

    expect(changes.added).toEqual([{ label: "SpO₂", value: "97%" }]);
    expect(changes.missing).toEqual([{ label: "Temperature", previous: "39.4 °C" }]);
    expect(changes.unchanged).toEqual([{ label: "Respiratory rate", value: "48 /min" }]);
    expect(changes.changed).toEqual([]);
  });

  it("leaves out readings missing from both sets and treats blank text as not recorded", () => {
    const previous = buildVitalsRecord({ capillaryRefillTime: "2 s", mucousMembraneColor: " " });
    const current = buildVitalsRecord({ capillaryRefillTime: "  ", mucousMembraneColor: null });

    expect(vitalsChanges(current, previous)).toEqual({
      changed: [],
      added: [],
      missing: [{ label: "Capillary refill time", previous: "2 s" }],
      unchanged: []
    });
  });

  it("compares text after trimming, and temperatures as they are shown", () => {
    const previous = buildVitalsRecord({ mucousMembraneColor: "Pink ", temperatureF: 102.01 });
    const current = buildVitalsRecord({ mucousMembraneColor: "Pink", temperatureF: 102.04 });

    expect(vitalsChanges(current, previous).unchanged).toEqual([
      { label: "Temperature", value: "38.9 °C" },
      { label: "Mucous membrane colour", value: "Pink" }
    ]);
  });
});
