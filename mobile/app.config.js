// Adds the git commit the app is built from to app.json's settings (shown at
// the bottom of the home and sign-in screens), so a phone can tell which
// build it has. EAS Build sets EAS_BUILD_GIT_COMMIT_HASH; elsewhere git is
// asked directly.

const { execSync } = require("node:child_process");

function commit() {
  if (process.env.EAS_BUILD_GIT_COMMIT_HASH) {
    return process.env.EAS_BUILD_GIT_COMMIT_HASH.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

module.exports = ({ config }) => ({
  ...config,
  extra: { ...config.extra, commit: commit() },
});
