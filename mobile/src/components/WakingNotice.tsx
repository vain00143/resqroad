import { useEffect, useState } from "react";

import { Notice } from "@/components/Notice";
import { getServerUrl, isHostedServer, wakingMessage } from "@/lib/api";

// Explains a long wait on the hosted server, which sleeps when nobody uses it:
// shown once a request has taken more than a couple of seconds.
export function WakingNotice({ active }: { active: boolean }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active || !isHostedServer(getServerUrl())) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(timer);
  }, [active]);

  return slow ? <Notice message={wakingMessage} /> : null;
}
