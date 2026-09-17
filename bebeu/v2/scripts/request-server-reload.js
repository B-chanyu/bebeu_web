"use strict";

const fs = require("fs");
const path = require("path");

const reloadFile = path.resolve(__dirname, "..", ".server-reload");
fs.writeFileSync(reloadFile, `${new Date().toISOString()}\n`, "utf8");
console.log("Managed bebeu server reload requested.");
