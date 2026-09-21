// SPDX-License-Identifier: Apache-2.0

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";

const output = fileURLToPath(new URL("../../contracts/openapi.json", import.meta.url));
const app = createApp();
const document = app.getOpenAPIDocument({
  info: {
    title: "Mecatl Studio API",
    version: "1.0.0",
  },
  openapi: "3.1.0",
});

await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, "utf8");
console.log(`Wrote ${output}`);
