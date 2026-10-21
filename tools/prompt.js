// Small terminal prompts for the setup tools.

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function ask(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

// Reads a line without echoing it to the screen (for passwords).
export function askHidden(question) {
  return new Promise(function (resolve) {
    const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
    rl._writeToOutput = function (text) {
      if (text.includes(question)) {
        stdout.write(question);
      }
    };
    rl.question(question).then(function (answer) {
      stdout.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}
