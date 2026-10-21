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

// Reads a password, showing * for each character typed (Backspace works;
// Ctrl+C cancels).
export function askHidden(question) {
  stdout.write(question);
  if (!stdin.isTTY) {
    return readPipedLine();
  }
  return new Promise(function (resolve) {
    let value = "";
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();

    function finish() {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      resolve(value);
    }

    function onData(chunk) {
      // Arrow keys and other special keys arrive as escape sequences.
      if (chunk.startsWith("\u001b")) {
        return;
      }
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish();
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130);
        }
        if (char === "\b" || char === "\u007f") {
          if (value) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
        } else if (char >= " ") {
          value += char;
          stdout.write("*");
        }
      }
    }

    stdin.on("data", onData);
  });
}

// Input piped from another program: read one line without echoing it.
async function readPipedLine() {
  const discard = new Writable({
    write: function (chunk, encoding, callback) {
      callback();
    },
  });
  const rl = readline.createInterface({ input: stdin, output: discard, terminal: true });
  try {
    return await rl.question("");
  } finally {
    rl.close();
    stdout.write("\n");
  }
}
