// Small terminal prompts for the setup tools.

import readline from "node:readline/promises";
import { Writable } from "node:stream";
import { stdin, stdout } from "node:process";

export async function ask(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

// Reads a line without showing it on screen (for passwords): the prompt goes
// to the screen, but readline's echo of each key goes to a stream that
// discards it.
export async function askHidden(question) {
  const discard = new Writable({
    write: function (chunk, encoding, callback) {
      callback();
    },
  });
  const rl = readline.createInterface({ input: stdin, output: discard, terminal: true });
  rl.on("SIGINT", function () {
    rl.close();
    stdout.write("\n");
    process.exit(130);
  });
  stdout.write(question);
  try {
    return await rl.question("");
  } finally {
    rl.close();
    stdout.write("\n");
  }
}
