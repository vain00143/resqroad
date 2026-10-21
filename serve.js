// Runs ResQRoad locally: the website, the API, and live updates, backed by
// MySQL (settings in .env). Usage: node serve.js [port]   (default port 8000)

import { startFromCommandLine } from "./server/index.js";

startFromCommandLine(process.argv[2] ? Number(process.argv[2]) : undefined);
