/**
 * Real outreach leads are git-ignored. Fresh clones get the example file so the app still builds.
 */
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "src", "data");
const target = path.join(dataDir, "outreach-leads.json");
const example = path.join(dataDir, "outreach-leads.example.json");

if (!fs.existsSync(target)) {
  fs.copyFileSync(example, target);
  console.log("outreach-leads.json missing; copied outreach-leads.example.json");
}
