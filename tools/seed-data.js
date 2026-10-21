// Sample accounts and reports loaded into Firestore by tools/seed.js.
// Dates are relative to when the seed runs, so the demo always looks current.

export const accounts = {
  admin: { email: "admin@resqroad.ph", password: "admin123", name: "Admin User" },
  crews: [
    { key: "juan-reyes", email: "juan.reyes@resqroad.ph", name: "Juan Reyes", team: "North road crew" },
    { key: "ana-cruz", email: "ana.cruz@resqroad.ph", name: "Ana Cruz", team: "Central road crew" },
    { key: "leo-santos", email: "leo.santos@resqroad.ph", name: "Leo Santos", team: "South road crew" },
  ],
  crewPassword: "crew123",
  citizens: [
    { email: "maria.santos@example.com", name: "Maria Santos", active: true, joinedDaysAgo: 260 },
    { email: "jose.delacruz@example.com", name: "Jose Dela Cruz", active: true, joinedDaysAgo: 240 },
    { email: "ana.reyes@example.com", name: "Ana Reyes", active: true, joinedDaysAgo: 220 },
    { email: "pedro.garcia@example.com", name: "Pedro Garcia", active: false, joinedDaysAgo: 200 },
    { email: "rosa.mendoza@example.com", name: "Rosa Mendoza", active: true, joinedDaysAgo: 180 },
    { email: "luis.flores@example.com", name: "Luis Flores", active: true, joinedDaysAgo: 150 },
    { email: "carla.bautista@example.com", name: "Carla Bautista", active: true, joinedDaysAgo: 90 },
    { email: "elena.navarro@example.com", name: "Elena Navarro", active: true, joinedDaysAgo: 60 },
  ],
  citizenPassword: "citizen123",
};

const dayMs = 24 * 60 * 60 * 1000;

export function daysAgo(days) {
  return new Date(Date.now() - days * dayMs).toISOString();
}

function event(status, description, days, actor, note) {
  const entry = { status: status, description: description, actor: actor || "ResQRoad", at: daysAgo(days) };
  if (note) {
    entry.note = note;
  }
  return entry;
}

// `reporter` and `crew` are an email and a crew key; seed.js swaps in account IDs.
export function sampleReports() {
  const open = [
    {
      id: "RPT-1048", title: "Deep pothole near the public market", road: "MacArthur Highway", location: "Guinhawa, Malolos City",
      lat: 14.8474, lng: 120.8122, severity: "High", reporter: "maria.santos@example.com", reportedDays: 0.15,
      description: "A deep pothole in the right lane is causing drivers to swerve. Reported near the public market entrance.",
      status: "submitted", crew: null,
      history: [["submitted", "Report received from a citizen.", 0.15]],
    },
    {
      id: "RPT-1047", title: "Pothole beside the school crossing", road: "Longos Road", location: "Longos, Malolos City",
      lat: 14.8681, lng: 120.7964, severity: "Medium", reporter: "jose.delacruz@example.com", reportedDays: 2,
      description: "There is a pothole near the pedestrian crossing. It gets harder to see after rain.",
      status: "under_review", crew: null,
      history: [["submitted", "Report received from a citizen.", 2], ["under_review", "Administrator started reviewing this report.", 0.5, "Admin User"]],
    },
    {
      id: "RPT-1046", title: "Broken road surface near the bridge", road: "Calumpit Bridge Road", location: "Calumpit, Bulacan",
      lat: 14.9189, lng: 120.7652, severity: "High", reporter: "ana.reyes@example.com", reportedDays: 4,
      description: "A damaged section of the lane is wide enough to affect motorcycles and cars.",
      status: "verified", crew: null,
      history: [["submitted", "Report received from a citizen.", 4], ["verified", "Administrator confirmed the reported road damage.", 2.5, "Admin User"]],
    },
    {
      id: "RPT-1045", title: "Road damage at the intersection", road: "Sta. Isabel Road", location: "Sta. Isabel, Malolos City",
      lat: 14.842, lng: 120.8088, severity: "High", reporter: "rosa.mendoza@example.com", reportedDays: 7,
      description: "The damaged patch is near an intersection and is difficult to avoid during busy hours.",
      status: "assigned", crew: "juan-reyes",
      history: [["submitted", "Report received from a citizen.", 7], ["verified", "Administrator confirmed the report.", 6, "Admin User"], ["assigned", "Assigned to Juan Reyes.", 5, "Administrator"]],
    },
    {
      id: "RPT-1044", title: "Small pothole expanding after rain", road: "Dakila Road", location: "Dakila, Malolos City",
      lat: 14.8592, lng: 120.8282, severity: "Low", reporter: "pedro.garcia@example.com", reportedDays: 12,
      description: "A small pothole has started to spread near the shoulder of the road.",
      status: "in_progress", crew: "ana-cruz",
      history: [["submitted", "Report received from a citizen.", 12], ["verified", "Administrator confirmed the report.", 10, "Admin User"], ["assigned", "Assigned to Ana Cruz.", 9, "Administrator"], ["in_progress", "Repair inspection has started.", 3, "Ana Cruz"]],
    },
    {
      id: "RPT-1043", title: "Pothole repaired near the barangay hall", road: "Tikay Road", location: "Tikay, Malolos City",
      lat: 14.8728, lng: 120.8141, severity: "Medium", reporter: "luis.flores@example.com", reportedDays: 16,
      description: "Road damage near the barangay hall was reported for inspection and repair.",
      status: "repair_submitted", crew: "juan-reyes",
      repair: { notes: "Filled the damaged section and cleared loose material from the lane.", before: ["repair-before.jpg"], after: ["repair-after.jpg"], days: 0.6 },
      history: [["submitted", "Report received from a citizen.", 16], ["verified", "Administrator confirmed the report.", 14, "Admin User"], ["assigned", "Assigned to Juan Reyes.", 13, "Administrator"], ["in_progress", "Repair inspection has started.", 9, "Juan Reyes"], ["repair_submitted", "Repair submitted for admin verification.", 0.6, "Juan Reyes"]],
    },
    {
      id: "RPT-1042", title: "Resolved road damage near the town plaza", road: "Plaridel Bypass Road", location: "Plaridel, Bulacan",
      lat: 14.8864, lng: 120.8574, severity: "Medium", reporter: "carla.bautista@example.com", reportedDays: 32,
      description: "A damaged patch on the roadside was reported and repaired.",
      status: "resolved", crew: "leo-santos",
      repair: { notes: "Repaired and leveled the road surface.", before: ["plaridel-before.jpg"], after: ["plaridel-after.jpg"], days: 25 },
      history: [["submitted", "Report received from a citizen.", 32], ["verified", "Administrator confirmed the report.", 31, "Admin User"], ["assigned", "Assigned to Leo Santos.", 30, "Administrator"], ["in_progress", "Repair work started.", 27, "Leo Santos"], ["repair_submitted", "Repair submitted for admin verification.", 25, "Leo Santos"], ["resolved", "Administrator verified the repair and closed the report.", 24, "Admin User"]],
    },
    {
      id: "RPT-1041", title: "Repeat report near the municipal hall", road: "Capitol View Park Road", location: "Guinhawa, Malolos City",
      lat: 14.8466, lng: 120.811, severity: "Low", reporter: "elena.navarro@example.com", reportedDays: 46,
      description: "This report refers to an existing pothole report nearby.",
      status: "duplicate", crew: null,
      history: [["submitted", "Report received from a citizen.", 46], ["duplicate", "Marked as a duplicate of another nearby report.", 45, "Admin User"]],
    },
    {
      id: "RPT-1051", title: "Pothole outside the health center", road: "Mabini Street", location: "Santiago, Malolos City",
      lat: 14.8506, lng: 120.8171, severity: "Medium", reporter: "jose.delacruz@example.com", reportedDays: 0.3,
      description: "A pothole near the health center entrance may cause vehicles to swerve.",
      status: "submitted", crew: null, history: [["submitted", "Report received from a citizen.", 0.3]],
    },
    {
      id: "RPT-1052", title: "Cracked pavement near the terminal", road: "Mojon Road", location: "Mojon, Malolos City",
      lat: 14.8531, lng: 120.8058, severity: "Low", reporter: "ana.reyes@example.com", reportedDays: 0.5,
      description: "A cracked section of pavement is starting to break apart near the terminal.",
      status: "submitted", crew: null, history: [["submitted", "Report received from a citizen.", 0.5]],
    },
    {
      id: "RPT-1053", title: "Deep road damage near the public school", road: "Paseo del Congreso", location: "Bulihan, Malolos City",
      lat: 14.8588, lng: 120.8186, severity: "High", reporter: "pedro.garcia@example.com", reportedDays: 0.8,
      description: "A deep damaged patch is close to the public school and affects passing vehicles.",
      status: "submitted", crew: null, history: [["submitted", "Report received from a citizen.", 0.8]],
    },
  ];

  // Closed reports from earlier months, so trends and resolution times have history.
  const past = [
    ["RPT-1031", "Washed-out shoulder after heavy rain", "Malolos–Paombong Road", "Paombong, Bulacan", 14.8311, 120.7894, "Medium", "The road shoulder washed out after the typhoon, leaving a drop-off along the lane edge.", "maria.santos@example.com", 228, "leo-santos", 6, "Rebuilt the shoulder with compacted base course and resurfaced the edge."],
    ["RPT-1032", "Pothole cluster near the bus stop", "MacArthur Highway", "Tikay, Malolos City", 14.8705, 120.8189, "High", "Several potholes in the outer lane beside the bus stop force jeepneys into the middle lane.", "rosa.mendoza@example.com", 214, "juan-reyes", 3, "Cold-patched four potholes and sealed the surrounding cracks."],
    ["RPT-1033", "Sunken manhole cover", "Pulilan–Baliuag Road", "Pulilan, Bulacan", 14.9021, 120.8492, "Medium", "A manhole cover has sunk below the road surface and jolts passing vehicles.", "jose.delacruz@example.com", 196, "ana-cruz", 5, "Raised the manhole frame to grade and patched the surrounding asphalt."],
    ["RPT-1034", "Uneven patch at the crossing", "Guiguinto Road", "Tabe, Guiguinto", 14.8337, 120.8791, "Low", "The pavement at the pedestrian crossing feels uneven.", "luis.flores@example.com", 171, null, 0, ""],
    ["RPT-1035", "Deep rut in the left lane", "Plaridel Bypass Road", "Lalangan, Plaridel", 14.8952, 120.8653, "High", "A long rut in the left lane holds water and is hard to see at night.", "ana.reyes@example.com", 158, "leo-santos", 4, "Milled the damaged lane section and laid new asphalt."],
    ["RPT-1036", "Crumbling pavement edge", "Calumpit–Pulilan Road", "Calumpit, Bulacan", 14.9105, 120.7801, "Low", "The pavement edge is crumbling into the drainage canal.", "carla.bautista@example.com", 133, "juan-reyes", 8, "Reinforced the pavement edge and cleared the canal inlet."],
    ["RPT-1037", "Pothole beside the church entrance", "Paseo del Congreso", "Barasoain, Malolos City", 14.8578, 120.8139, "Medium", "A pothole beside the church entrance is in the path of tricycles dropping off passengers.", "elena.navarro@example.com", 104, "ana-cruz", 3, "Filled and compacted the pothole with hot-mix asphalt."],
    ["RPT-1038", "Large pothole on the service road", "NLEX Service Road", "Sta. Rita, Guiguinto", 14.8456, 120.8902, "High", "A large pothole on the service road has already caused a flat tire.", "maria.santos@example.com", 77, "juan-reyes", 2, "Emergency patch completed the same day; full repair done after curing."],
    ["RPT-1039", "Cracked asphalt near the market", "Mabini Street", "Santo Rosario, Malolos City", 14.8441, 120.8126, "Low", "Alligator cracking is spreading across the lane near the market.", "rosa.mendoza@example.com", 58, "ana-cruz", 5, "Sealed the cracks and applied a surface treatment."],
    ["RPT-1040", "Damaged lane at the bridge approach", "Calumpit Bridge Road", "Calumpit, Bulacan", 14.9163, 120.7678, "Medium", "The bridge approach slab has separated from the road, leaving a bump.", "jose.delacruz@example.com", 41, "leo-santos", 4, "Leveled the approach slab joint and patched the transition."],
  ].map(function (seed) {
    const [id, title, road, location, lat, lng, severity, description, reporter, age, crew, fixDays, notes] = seed;
    const crewName = crew ? accounts.crews.find((item) => item.key === crew).name : null;
    const history = [["submitted", "Report received from a citizen.", age]];
    if (!crew) {
      history.push(["rejected", "Administrator rejected this report.", age - 1, "Admin User", "Inspection found no road damage at the reported location."]);
    } else {
      history.push(
        ["verified", "Administrator confirmed the reported road damage.", age - 1, "Admin User"],
        ["assigned", "Assigned to " + crewName + ".", age - 2, "Admin User"],
        ["in_progress", "Repair work started.", age - 3, crewName],
        ["repair_submitted", "Repair submitted for admin verification.", age - 3 - fixDays, crewName],
        ["resolved", "Administrator verified the repair and closed the report.", age - 4 - fixDays, "Admin User"],
      );
    }
    return {
      id, title, road, location, lat, lng, severity, description, reporter, reportedDays: age,
      status: crew ? "resolved" : "rejected",
      crew,
      repair: crew ? { notes, before: [id.toLowerCase() + "-before.jpg"], after: [id.toLowerCase() + "-after.jpg"], days: age - 3 - fixDays } : null,
      history,
    };
  });

  return open.concat(past).map(function (item) {
    return {
      id: item.id,
      title: item.title,
      road: item.road,
      location: item.location,
      coordinates: { lat: item.lat, lng: item.lng },
      severity: item.severity,
      description: item.description,
      reporterEmail: item.reporter,
      reportedAt: daysAgo(item.reportedDays),
      evidencePhotos: [item.id.toLowerCase() + ".jpg"],
      status: item.status,
      crewKey: item.crew,
      repair: item.repair
        ? { notes: item.repair.notes, beforePhotos: item.repair.before, afterPhotos: item.repair.after, submittedAt: daysAgo(item.repair.days) }
        : null,
      history: item.history.map((entry) => event(entry[0], entry[1], entry[2], entry[3], entry[4])),
    };
  });
}
