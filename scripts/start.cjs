#!/usr/bin/env node
const { spawn } = require("node:child_process");
const port = process.env.PORT || "43147";
const child = spawn(
  "npx",
  ["next", "start", "--hostname", "0.0.0.0", "--port", String(port)],
  { stdio: "inherit", shell: true },
);
child.on("exit", (code) => process.exit(code ?? 1));
