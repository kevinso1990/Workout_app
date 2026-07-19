import { execSync } from "node:child_process";
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";

const buildId = process.argv[2] ?? "5bb056e6-d5e5-4172-9873-ca98e3558a47";
const json = execSync(`npx eas-cli build:view ${buildId} --json`, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const url = JSON.parse(json).logFiles?.[0];
if (!url) {
  console.error("No log URL");
  process.exit(1);
}
const buf = execSync(`curl.exe -s --max-time 90 "${url}"`, {
  encoding: "buffer",
  maxBuffer: 50 * 1024 * 1024,
});
let text = "";
for (const fn of [gunzipSync, inflateSync, brotliDecompressSync]) {
  try {
    text = fn(buf).toString("utf8");
    break;
  } catch {
    /* try next */
  }
}
if (!text) text = buf.toString("utf8");

const pattern =
  /FAILURE|BUILD FAILED|error:|Error:|Exception|AAPT|> Task .*FAILED|What went wrong|Execution failed|Gradle build failed/i;
const hits = text.split(/\r?\n/).filter((l) => pattern.test(l));
console.log(hits.slice(-100).join("\n"));
if (hits.length === 0) {
  console.log("---TAIL---");
  console.log(text.slice(-12000));
}
