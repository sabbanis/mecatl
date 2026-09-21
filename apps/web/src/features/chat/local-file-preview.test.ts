// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { imagePreview, imageSource, localFileKind } from "./local-file-preview";

describe("local file previews", () => {
  it("classifies supported browser previews", () => {
    expect(localFileKind("photo.png", "image/png")).toBe("image");
    expect(localFileKind("README.md", "text/markdown")).toBe("markdown");
    expect(localFileKind("worker.ts", "")).toBe("code");
    expect(localFileKind("report.pdf", "application/pdf")).toBe("pdf");
    expect(localFileKind("archive.zip", "application/zip")).toBe("unsupported");
  });

  it("builds image sources and estimates persisted image sizes", () => {
    const inline = { data: "aGVsbG8=", mimeType: "image/png", name: "Image 1" };
    expect(imageSource(inline)).toBe("data:image/png;base64,aGVsbG8=");
    expect(imagePreview(inline, true)).toMatchObject({ sent: true, size: 5 });
    expect(
      imageSource({
        mimeType: "image/webp",
        name: "Image 2",
        url: "https://example.com/image.webp",
      }),
    ).toBe("https://example.com/image.webp");
  });
});
