import { describe, expect, it } from "vitest";
import indexHtml from "../../index.html?raw";
import favicon from "../../public/favicon.svg?raw";
import robots from "../../public/robots.txt?raw";

// The static shell every page loads before React runs.
function parseIndex() {
  return new DOMParser().parseFromString(indexHtml, "text/html");
}

describe("index.html", () => {
  it("names the app in the browser tab", () => {
    expect(parseIndex().title).toBe("VetiFlow");
  });

  it("asks search engines not to index or follow any page", () => {
    const robotsMeta = parseIndex().querySelector('meta[name="robots"]');

    expect(robotsMeta?.getAttribute("content")).toBe("noindex, nofollow");
  });

  it("links the favicon that public/ provides", () => {
    const icon = parseIndex().querySelector('link[rel="icon"]');

    expect(icon?.getAttribute("href")).toBe("/favicon.svg");
    expect(favicon).toMatch(/^<svg[\s>]/);
  });
});

describe("robots.txt", () => {
  it("disallows every crawler from every path", () => {
    const lines = robots.split(/\r?\n/).map((line) => line.trim());

    expect(lines).toContain("User-agent: *");
    expect(lines).toContain("Disallow: /");
  });
});
