import { composeSnapshot, diffObservations, type ViewportObservation } from "../src/features/agent/viewportObservation";

const baseObservation: ViewportObservation = {
  url: "http://localhost:5173/",
  title: "Poly Preview",
  readyState: "complete",
  viewport: { width: 1024, height: 768, scrollY: 0 },
  focusedElement: null,
  buttons: ["Save"],
  links: [],
  inputs: [],
  headings: [{ level: 1, text: "Dashboard" }],
  forms: 0,
  regions: ["main"],
  textSummary: "Dashboard Save",
  consoleErrors: [],
  consoleErrorCount: 0,
  consoleWarnings: [],
  consoleWarningCount: 0,
  networkFailures: [],
  networkFailureCount: 0,
  domHash: "one",
};

describe("viewport observations", () => {
  it("returns only the no-change note when the DOM hash is unchanged", () => {
    expect(composeSnapshot(baseObservation, { ...baseObservation })).toEqual({
      kind: "unchanged",
      url: baseObservation.url,
      title: baseObservation.title,
      note: "No DOM changes.",
      console: "No console errors, warnings, or network failures.",
    });
  });

  it("diffs visible controls instead of resending the whole page", () => {
    const changes = diffObservations(baseObservation, {
      ...baseObservation,
      buttons: ["Publish"],
      textSummary: "Dashboard Publish",
      domHash: "two",
    });

    expect(changes).toEqual(["Added button: Publish", "Removed button: Save"]);
  });
});
