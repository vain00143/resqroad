/* Possible duplicate reports, shared by the website (the report form and the
   administrator's review) and the server, which checks again when a report
   is filed.

   A new report is a possible duplicate of an existing one when they are close
   together and describe the same road problem. Distance counts the most, then
   the kind of problem (pothole, crack, flooding, ...), how alike the titles
   and descriptions are, and the severity. Two different problems at the same
   spot (say, a pothole and a fallen sign) are not duplicates, and reports
   farther apart than `duplicateRadiusMeters` never are. */

export const duplicateRadiusMeters = 150;
const sameSpotMeters = 25;
const threshold = 0.6;

const openStatuses = ["submitted", "under_review", "verified", "assigned", "in_progress", "repair_submitted"];
const severityRank = { Low: 1, Medium: 2, High: 3 };

// Words that name a kind of road problem (English and Filipino).
const problemWords = {
  pothole: ["pothole", "hole", "lubak", "butas", "crater"],
  crack: ["crack", "cracked", "cracking", "bitak", "fissure"],
  flooding: ["flood", "flooded", "flooding", "baha", "drain", "drainage", "canal", "clogged", "manhole"],
  collapse: ["sinkhole", "collapse", "collapsed", "subsided", "gumuho", "landslide"],
  erosion: ["shoulder", "erosion", "eroded", "washed", "washout"],
  surface: ["uneven", "bump", "rut", "ruts", "rough", "worn", "depression"],
  obstruction: ["debris", "fallen", "tree", "rock", "obstruction", "blocked", "garbage"],
  signage: ["sign", "signage", "marking", "streetlight", "railing", "guardrail"],
  bridge: ["bridge", "culvert"],
};
const problemLabels = {
  pothole: "a pothole",
  crack: "cracked pavement",
  flooding: "flooding or drainage",
  collapse: "a sinkhole or collapse",
  erosion: "an eroded shoulder",
  surface: "an uneven surface",
  obstruction: "an obstruction",
  signage: "a damaged sign or marking",
  bridge: "a bridge or culvert",
};

const stopWords = new Set(
  (
    "the and for with from this that there these those near very into onto over under along beside " +
    "road street avenue highway lane area side part spot place front back left right just also been " +
    "being have has had are was were its it's our your their they them can could would should will " +
    "about around after before again still some more most much many which where when what while " +
    "sa ang mga ng na at may yung ito"
  ).split(" "),
);

function words(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9ñ]+/)
    .map(function (word) {
      // "potholes" and "pothole" count as the same word.
      return word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
    })
    .filter(function (word) {
      return word.length >= 3 && !stopWords.has(word);
    });
}

function problemTypes(list) {
  const found = new Set();
  Object.keys(problemWords).forEach(function (type) {
    if (problemWords[type].some(function (word) { return list.includes(word); })) {
      found.add(type);
    }
  });
  return found;
}

function overlap(first, second) {
  const a = new Set(first);
  const b = new Set(second);
  if (!a.size || !b.size) {
    return 0;
  }
  let shared = 0;
  a.forEach(function (word) {
    if (b.has(word)) {
      shared += 1;
    }
  });
  return shared / (a.size + b.size - shared);
}

function point(item) {
  if (item.coordinates) {
    return { lat: Number(item.coordinates.lat), lng: Number(item.coordinates.lng) };
  }
  return { lat: Number(item.latitude), lng: Number(item.longitude) };
}

// Straight-line distance in meters between two { lat, lng } points.
export function distanceMeters(from, to) {
  const radians = Math.PI / 180;
  const dLat = (to.lat - from.lat) * radians;
  const dLng = (to.lng - from.lng) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(from.lat * radians) * Math.cos(to.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isActiveReport(report) {
  return openStatuses.includes(report.status);
}

// How alike two reports are, from 0 to 1, with the reasons a person can read.
// Returns null when they are too far apart or describe different problems.
function compare(candidate, report) {
  const from = point(candidate);
  const to = point(report);
  if (![from.lat, from.lng, to.lat, to.lng].every(Number.isFinite)) {
    return null;
  }
  const distance = distanceMeters(from, to);
  if (distance > duplicateRadiusMeters) {
    return null;
  }
  const proximity =
    distance <= sameSpotMeters ? 1 : 1 - (distance - sameSpotMeters) / (duplicateRadiusMeters - sameSpotMeters);

  const candidateWords = words(candidate.title + " " + candidate.description);
  const reportWords = words(report.title + " " + report.description);
  const candidateTypes = problemTypes(candidateWords);
  const reportTypes = problemTypes(reportWords);
  const sharedTypes = Array.from(candidateTypes).filter(function (type) {
    return reportTypes.has(type);
  });
  // Unknown when either report doesn't say what kind of problem it is.
  const category = candidateTypes.size && reportTypes.size ? (sharedTypes.length ? 1 : 0) : 0.5;
  const text = Math.min(1, overlap(candidateWords, reportWords) * 2.5);
  const severityGap = Math.abs((severityRank[candidate.severity] || 2) - (severityRank[report.severity] || 2));
  const severity = severityGap === 0 ? 1 : severityGap === 1 ? 0.5 : 0;

  // A different kind of problem with different wording isn't a duplicate,
  // however close it is.
  if (category === 0 && text < 0.4) {
    return null;
  }
  const score = 0.5 * proximity + 0.2 * category + 0.2 * text + 0.1 * severity;
  if (score < threshold) {
    return null;
  }

  const reasons = [distance <= sameSpotMeters ? "At almost the same spot" : "About " + Math.round(distance / 5) * 5 + " m away"];
  if (sharedTypes.length) {
    reasons.push("Also reports " + problemLabels[sharedTypes[0]]);
  }
  if (text >= 0.5) {
    reasons.push("Similar title and description");
  }
  if (severity === 1) {
    reasons.push("Same severity (" + report.severity + ")");
  }
  return { distance: Math.round(distance), score: Math.round(score * 100) / 100, reasons: reasons };
}

// Existing reports that may describe the same road problem as `candidate`
// ({ id?, title, description, severity, latitude/longitude or coordinates }).
// Open reports come first. Fixed reports are included only with
// options.includeResolved (useful to know about, but not the same as one
// still being handled); rejected and duplicate reports never are.
export function findSimilarReports(candidate, reports, options) {
  const settings = options || {};
  return (reports || [])
    .filter(function (report) {
      if (candidate.id && report.id === candidate.id) {
        return false;
      }
      return isActiveReport(report) || (settings.includeResolved && report.status === "resolved");
    })
    .map(function (report) {
      const match = compare(candidate, report);
      return match ? Object.assign({ report: report, active: isActiveReport(report) }, match) : null;
    })
    .filter(Boolean)
    .sort(function (first, second) {
      return Number(second.active) - Number(first.active) || second.score - first.score || first.distance - second.distance;
    })
    .slice(0, settings.limit || 5);
}
