// A new set only. Recorder and timestamp are supplied by the API.
export interface RecordVitalsRequest {
  heartRate?: number;
  respiratoryRate?: number;
  temperatureF?: number;
  spO2?: number;
  mucousMembraneColor?: string;
  capillaryRefillTime?: string;
  mentation?: string;
}
