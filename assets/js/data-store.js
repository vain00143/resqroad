/* ResQRoad data store. Everything lives in this browser's localStorage under
   one key, shared by the public site and every workspace on the same origin.
   The API keeps the original RoadWatchStore names so saved data and older
   pages keep working; migrations below upgrade data saved by earlier builds. */
(function () {
  "use strict";

  const storageKey = "roadwatch-demo-v1";
  const dayMs = 24 * 60 * 60 * 1000;
  const openStatuses = ["submitted", "under_review", "verified", "assigned", "in_progress", "repair_submitted"];
  const closedStatuses = ["resolved", "rejected", "duplicate"];
  const crewOpenStatuses = ["assigned", "in_progress", "repair_submitted"];
  const statuses = {
    submitted: "Submitted",
    under_review: "Under Review",
    verified: "Verified",
    assigned: "Assigned",
    in_progress: "In Progress",
    repair_submitted: "Repair Submitted",
    resolved: "Resolved",
    rejected: "Rejected",
    duplicate: "Duplicate",
  };
  const adminEmail = "admin@resqroad.ph";
  const defaultCitizenPassword = "citizen123";

  // Days ago each sample report was filed, and when each step of its seeded
  // history happened, so the journey dates line up with the report date.
  const sampleTimelines = {
    "RPT-1048": { reported: 0.15, events: { submitted: 0.15 } },
    "RPT-1047": { reported: 2, events: { submitted: 2, under_review: 0.5 } },
    "RPT-1046": { reported: 4, events: { submitted: 4, verified: 2.5 } },
    "RPT-1045": { reported: 7, events: { submitted: 7, verified: 6, assigned: 5 } },
    "RPT-1044": { reported: 12, events: { submitted: 12, verified: 10, assigned: 9, in_progress: 3 } },
    "RPT-1043": {
      reported: 16,
      events: { submitted: 16, verified: 14, assigned: 13, in_progress: 9, repair_submitted: 0.6 },
    },
    "RPT-1042": {
      reported: 32,
      events: { submitted: 32, verified: 31, assigned: 30, in_progress: 27, repair_submitted: 25, resolved: 24 },
    },
    "RPT-1041": { reported: 46, events: { submitted: 46, duplicate: 45 } },
    "RPT-1051": { reported: 0.3, events: { submitted: 0.3 } },
    "RPT-1052": { reported: 0.5, events: { submitted: 0.5 } },
    "RPT-1053": { reported: 0.8, events: { submitted: 0.8 } },
  };

  const personnel = [
    { id: "juan-reyes", name: "Juan Reyes", email: "juan.reyes@resqroad.ph", team: "North road crew" },
    { id: "ana-cruz", name: "Ana Cruz", email: "ana.cruz@resqroad.ph", team: "Central road crew" },
    { id: "leo-santos", name: "Leo Santos", email: "leo.santos@resqroad.ph", team: "South road crew" },
  ];

  const citizens = [
    { id: "citizen-maria-santos", name: "Maria Santos", email: "maria.santos@example.com", active: true, joinedDaysAgo: 260 },
    { id: "citizen-jose-dela-cruz", name: "Jose Dela Cruz", email: "jose.delacruz@example.com", active: true, joinedDaysAgo: 240 },
    { id: "citizen-ana-reyes", name: "Ana Reyes", email: "ana.reyes@example.com", active: true, joinedDaysAgo: 220 },
    { id: "citizen-pedro-garcia", name: "Pedro Garcia", email: "pedro.garcia@example.com", active: false, joinedDaysAgo: 200 },
  ];

  // Citizens behind the remaining sample reports, added by a migration.
  const additionalCitizens = [
    { id: "citizen-rosa-mendoza", name: "Rosa Mendoza", email: "rosa.mendoza@example.com", active: true, joinedDaysAgo: 180 },
    { id: "citizen-luis-flores", name: "Luis Flores", email: "luis.flores@example.com", active: true, joinedDaysAgo: 150 },
    { id: "citizen-carla-bautista", name: "Carla Bautista", email: "carla.bautista@example.com", active: true, joinedDaysAgo: 90 },
    { id: "citizen-elena-navarro", name: "Elena Navarro", email: "elena.navarro@example.com", active: true, joinedDaysAgo: 60 },
  ];

  // Sample reporters are stored with short names; these link them to accounts.
  const sampleReporters = {
    "M. Santos": "maria.santos@example.com",
    "J. Dela Cruz": "jose.delacruz@example.com",
    "A. Reyes": "ana.reyes@example.com",
    "R. Mendoza": "rosa.mendoza@example.com",
    "P. Garcia": "pedro.garcia@example.com",
    "L. Flores": "luis.flores@example.com",
    "C. Bautista": "carla.bautista@example.com",
    "E. Navarro": "elena.navarro@example.com",
  };

  function daysAgo(days) {
    return new Date(Date.now() - days * dayMs).toISOString();
  }

  function event(status, description, days, actor) {
    return {
      status: status,
      description: description,
      actor: actor || "ResQRoad",
      at: daysAgo(days),
    };
  }

  function timelineDay(reportId, status, fallback) {
    const timeline = sampleTimelines[reportId];
    return timeline && Object.prototype.hasOwnProperty.call(timeline.events, status)
      ? timeline.events[status]
      : fallback;
  }

  function reportedDay(reportId) {
    return sampleTimelines[reportId] ? sampleTimelines[reportId].reported : 0;
  }

  function createSampleReports() {
    return [
      {
        id: "RPT-1048",
        title: "Deep pothole near the public market",
        road: "MacArthur Highway",
        location: "Guinhawa, Malolos City",
        coordinates: { lat: 14.8474, lng: 120.8122 },
        severity: "High",
        description:
          "A deep pothole in the right lane is causing drivers to swerve. Reported near the public market entrance.",
        reporter: "M. Santos",
        reportedAt: daysAgo(reportedDay("RPT-1048")),
        evidencePhotos: ["market-road-damage.jpg"],
        status: "submitted",
        assignedTo: null,
        repair: null,
        history: [event("submitted", "Report received from a citizen.", timelineDay("RPT-1048", "submitted", 0))],
      },
      {
        id: "RPT-1047",
        title: "Pothole beside the school crossing",
        road: "Longos Road",
        location: "Longos, Malolos City",
        coordinates: { lat: 14.8681, lng: 120.7964 },
        severity: "Medium",
        description: "There is a pothole near the pedestrian crossing. It gets harder to see after rain.",
        reporter: "J. Dela Cruz",
        reportedAt: daysAgo(reportedDay("RPT-1047")),
        evidencePhotos: ["longos-crossing.jpg"],
        status: "under_review",
        assignedTo: null,
        repair: null,
        history: [
          event("submitted", "Report received from a citizen.", timelineDay("RPT-1047", "submitted", 1)),
          event("under_review", "Administrator started reviewing this report.", timelineDay("RPT-1047", "under_review", 0)),
        ],
      },
      {
        id: "RPT-1046",
        title: "Broken road surface near the bridge",
        road: "Calumpit Bridge Road",
        location: "Calumpit, Bulacan",
        coordinates: { lat: 14.9189, lng: 120.7652 },
        severity: "High",
        description: "A damaged section of the lane is wide enough to affect motorcycles and cars.",
        reporter: "A. Reyes",
        reportedAt: daysAgo(reportedDay("RPT-1046")),
        evidencePhotos: ["bridge-road.jpg"],
        status: "verified",
        assignedTo: null,
        repair: null,
        history: [
          event("submitted", "Report received from a citizen.", timelineDay("RPT-1046", "submitted", 2)),
          event("verified", "Administrator confirmed the reported road damage.", timelineDay("RPT-1046", "verified", 1)),
        ],
      },
      {
        id: "RPT-1045",
        title: "Road damage at the intersection",
        road: "Sta. Isabel Road",
        location: "Sta. Isabel, Malolos City",
        coordinates: { lat: 14.842, lng: 120.8088 },
        severity: "High",
        description: "The damaged patch is near an intersection and is difficult to avoid during busy hours.",
        reporter: "R. Mendoza",
        reportedAt: daysAgo(reportedDay("RPT-1045")),
        evidencePhotos: ["sta-isabel-intersection.jpg"],
        status: "assigned",
        assignedTo: "juan-reyes",
        repair: null,
        history: [
          event("submitted", "Report received from a citizen.", timelineDay("RPT-1045", "submitted", 3)),
          event("verified", "Administrator confirmed the report.", timelineDay("RPT-1045", "verified", 2)),
          event("assigned", "Assigned to Juan Reyes.", timelineDay("RPT-1045", "assigned", 1)),
        ],
      },
      {
        id: "RPT-1044",
        title: "Small pothole expanding after rain",
        road: "Dakila Road",
        location: "Dakila, Malolos City",
        coordinates: { lat: 14.8592, lng: 120.8282 },
        severity: "Low",
        description: "A small pothole has started to spread near the shoulder of the road.",
        reporter: "P. Garcia",
        reportedAt: daysAgo(reportedDay("RPT-1044")),
        evidencePhotos: ["dakila-road.jpg"],
        status: "in_progress",
        assignedTo: "ana-cruz",
        repair: null,
        history: [
          event("submitted", "Report received from a citizen.", timelineDay("RPT-1044", "submitted", 4)),
          event("verified", "Administrator confirmed the report.", timelineDay("RPT-1044", "verified", 3)),
          event("assigned", "Assigned to Ana Cruz.", timelineDay("RPT-1044", "assigned", 2)),
          event("in_progress", "Repair inspection has started.", timelineDay("RPT-1044", "in_progress", 1)),
        ],
      },
      {
        id: "RPT-1043",
        title: "Pothole repaired near the barangay hall",
        road: "Tikay Road",
        location: "Tikay, Malolos City",
        coordinates: { lat: 14.8728, lng: 120.8141 },
        severity: "Medium",
        description: "Road damage near the barangay hall was reported for inspection and repair.",
        reporter: "L. Flores",
        reportedAt: daysAgo(reportedDay("RPT-1043")),
        evidencePhotos: ["tikay-before.jpg"],
        status: "repair_submitted",
        assignedTo: "juan-reyes",
        repair: {
          notes: "Filled the damaged section and cleared loose material from the lane.",
          beforePhotos: ["repair-before.jpg"],
          afterPhotos: ["repair-after.jpg"],
          submittedAt: daysAgo(timelineDay("RPT-1043", "repair_submitted", 0)),
        },
        history: [
          event("submitted", "Report received from a citizen.", timelineDay("RPT-1043", "submitted", 6)),
          event("verified", "Administrator confirmed the report.", timelineDay("RPT-1043", "verified", 5)),
          event("assigned", "Assigned to Juan Reyes.", timelineDay("RPT-1043", "assigned", 4)),
          event("in_progress", "Repair inspection has started.", timelineDay("RPT-1043", "in_progress", 2)),
          event("repair_submitted", "Repair submitted for admin verification.", timelineDay("RPT-1043", "repair_submitted", 0)),
        ],
      },
      {
        id: "RPT-1042",
        title: "Resolved road damage near the town plaza",
        road: "Plaridel Bypass Road",
        location: "Plaridel, Bulacan",
        coordinates: { lat: 14.8864, lng: 120.8574 },
        severity: "Medium",
        description: "A damaged patch on the roadside was reported and repaired.",
        reporter: "C. Bautista",
        reportedAt: daysAgo(reportedDay("RPT-1042")),
        evidencePhotos: ["plaridel-before.jpg"],
        status: "resolved",
        assignedTo: "leo-santos",
        repair: {
          notes: "Repaired and leveled the road surface.",
          beforePhotos: ["plaridel-before.jpg"],
          afterPhotos: ["plaridel-after.jpg"],
          submittedAt: daysAgo(timelineDay("RPT-1042", "repair_submitted", 3)),
        },
        history: [
          event("submitted", "Report received from a citizen.", timelineDay("RPT-1042", "submitted", 9)),
          event("verified", "Administrator confirmed the report.", timelineDay("RPT-1042", "verified", 8)),
          event("assigned", "Assigned to Leo Santos.", timelineDay("RPT-1042", "assigned", 7)),
          event("in_progress", "Repair work started.", timelineDay("RPT-1042", "in_progress", 5)),
          event("repair_submitted", "Repair submitted for admin verification.", timelineDay("RPT-1042", "repair_submitted", 3)),
          event("resolved", "Administrator verified the repair and closed the report.", timelineDay("RPT-1042", "resolved", 2)),
        ],
      },
      {
        id: "RPT-1041",
        title: "Repeat report near the municipal hall",
        road: "Capitol View Park Road",
        location: "Guinhawa, Malolos City",
        coordinates: { lat: 14.8466, lng: 120.811 },
        severity: "Low",
        description: "This report refers to an existing pothole report nearby.",
        reporter: "E. Navarro",
        reportedAt: daysAgo(reportedDay("RPT-1041")),
        evidencePhotos: ["capitol-road.jpg"],
        status: "duplicate",
        assignedTo: null,
        repair: null,
        history: [
          event("submitted", "Report received from a citizen.", timelineDay("RPT-1041", "submitted", 10)),
          event("duplicate", "Marked as a duplicate of another nearby report.", timelineDay("RPT-1041", "duplicate", 9)),
        ],
      },
    ];
  }

  function createAdditionalSubmittedReports() {
    return [
      {
        id: "RPT-1051",
        title: "Pothole outside the health center",
        road: "Mabini Street",
        location: "Santiago, Malolos City",
        coordinates: { lat: 14.8506, lng: 120.8171 },
        severity: "Medium",
        description: "A pothole near the health center entrance may cause vehicles to swerve.",
        reporter: "J. Dela Cruz",
        reportedAt: daysAgo(reportedDay("RPT-1051")),
        evidencePhotos: ["longos-crossing.jpg"],
        status: "submitted",
        assignedTo: null,
        repair: null,
        history: [event("submitted", "Report received from a citizen.", timelineDay("RPT-1051", "submitted", 0))],
      },
      {
        id: "RPT-1052",
        title: "Cracked pavement near the terminal",
        road: "Mojon Road",
        location: "Mojon, Malolos City",
        coordinates: { lat: 14.8531, lng: 120.8058 },
        severity: "Low",
        description: "A cracked section of pavement is starting to break apart near the terminal.",
        reporter: "A. Reyes",
        reportedAt: daysAgo(reportedDay("RPT-1052")),
        evidencePhotos: ["bridge-road.jpg"],
        status: "submitted",
        assignedTo: null,
        repair: null,
        history: [event("submitted", "Report received from a citizen.", timelineDay("RPT-1052", "submitted", 0))],
      },
      {
        id: "RPT-1053",
        title: "Deep road damage near the public school",
        road: "Paseo del Congreso",
        location: "Bulihan, Malolos City",
        coordinates: { lat: 14.8588, lng: 120.8186 },
        severity: "High",
        description: "A deep damaged patch is close to the public school and affects passing vehicles.",
        reporter: "P. Garcia",
        reportedAt: daysAgo(reportedDay("RPT-1053")),
        evidencePhotos: ["sta-isabel-intersection.jpg"],
        status: "submitted",
        assignedTo: null,
        repair: null,
        history: [event("submitted", "Report received from a citizen.", timelineDay("RPT-1053", "submitted", 0))],
      },
    ];
  }

  // Closed reports from earlier months, so trends and resolution times have
  // history to work with.
  function createHistoricalReports() {
    const seeds = [
      ["RPT-1031", "Washed-out shoulder after heavy rain", "Malolos–Paombong Road", "Paombong, Bulacan", 14.8311, 120.7894, "Medium", "The road shoulder washed out after the typhoon, leaving a drop-off along the lane edge.", "M. Santos", 228, "leo-santos", 6, "Rebuilt the shoulder with compacted base course and resurfaced the edge."],
      ["RPT-1032", "Pothole cluster near the bus stop", "MacArthur Highway", "Tikay, Malolos City", 14.8705, 120.8189, "High", "Several potholes in the outer lane beside the bus stop force jeepneys into the middle lane.", "R. Mendoza", 214, "juan-reyes", 3, "Cold-patched four potholes and sealed the surrounding cracks."],
      ["RPT-1033", "Sunken manhole cover", "Pulilan–Baliuag Road", "Pulilan, Bulacan", 14.9021, 120.8492, "Medium", "A manhole cover has sunk below the road surface and jolts passing vehicles.", "J. Dela Cruz", 196, "ana-cruz", 5, "Raised the manhole frame to grade and patched the surrounding asphalt."],
      ["RPT-1034", "Uneven patch at the crossing", "Guiguinto Road", "Tabe, Guiguinto", 14.8337, 120.8791, "Low", "The pavement at the pedestrian crossing feels uneven.", "L. Flores", 171, null, 0, ""],
      ["RPT-1035", "Deep rut in the left lane", "Plaridel Bypass Road", "Lalangan, Plaridel", 14.8952, 120.8653, "High", "A long rut in the left lane holds water and is hard to see at night.", "A. Reyes", 158, "leo-santos", 4, "Milled the damaged lane section and laid new asphalt."],
      ["RPT-1036", "Crumbling pavement edge", "Calumpit–Pulilan Road", "Calumpit, Bulacan", 14.9105, 120.7801, "Low", "The pavement edge is crumbling into the drainage canal.", "C. Bautista", 133, "juan-reyes", 8, "Reinforced the pavement edge and cleared the canal inlet."],
      ["RPT-1037", "Pothole beside the church entrance", "Paseo del Congreso", "Barasoain, Malolos City", 14.8578, 120.8139, "Medium", "A pothole beside the church entrance is in the path of tricycles dropping off passengers.", "E. Navarro", 104, "ana-cruz", 3, "Filled and compacted the pothole with hot-mix asphalt."],
      ["RPT-1038", "Large pothole on the service road", "NLEX Service Road", "Sta. Rita, Guiguinto", 14.8456, 120.8902, "High", "A large pothole on the service road has already caused a flat tire.", "M. Santos", 77, "juan-reyes", 2, "Emergency patch completed the same day; full repair done after curing."],
      ["RPT-1039", "Cracked asphalt near the market", "Mabini Street", "Santo Rosario, Malolos City", 14.8441, 120.8126, "Low", "Alligator cracking is spreading across the lane near the market.", "R. Mendoza", 58, "ana-cruz", 5, "Sealed the cracks and applied a surface treatment."],
      ["RPT-1040", "Damaged lane at the bridge approach", "Calumpit Bridge Road", "Calumpit, Bulacan", 14.9163, 120.7678, "Medium", "The bridge approach slab has separated from the road, leaving a bump.", "J. Dela Cruz", 41, "leo-santos", 4, "Leveled the approach slab joint and patched the transition."],
    ];

    return seeds.map(function (seed) {
      const [id, title, road, location, lat, lng, severity, description, reporter, age, crewId, fixDays, notes] = seed;
      const crew = personnel.find(function (person) {
        return person.id === crewId;
      });
      const report = {
        id: id,
        title: title,
        road: road,
        location: location,
        coordinates: { lat: lat, lng: lng },
        severity: severity,
        description: description,
        reporter: reporter,
        reportedAt: daysAgo(age),
        evidencePhotos: [id.toLowerCase() + ".jpg"],
        status: crew ? "resolved" : "rejected",
        assignedTo: crew ? crew.id : null,
        repair: null,
        history: [event("submitted", "Report received from a citizen.", age)],
      };
      if (!crew) {
        report.history.push(
          Object.assign(event("rejected", "Administrator rejected this report.", age - 1, "Admin User"), {
            note: "Inspection found no road damage at the reported location.",
          }),
        );
        return report;
      }
      report.assignedName = crew.name;
      report.repair = {
        notes: notes,
        beforePhotos: [id.toLowerCase() + "-before.jpg"],
        afterPhotos: [id.toLowerCase() + "-after.jpg"],
        submittedAt: daysAgo(age - 3 - fixDays),
      };
      report.history.push(
        event("verified", "Administrator confirmed the reported road damage.", age - 1, "Admin User"),
        event("assigned", "Assigned to " + crew.name + ".", age - 2, "Admin User"),
        event("in_progress", "Repair work started.", age - 3, crew.name),
        event("repair_submitted", "Repair submitted for admin verification.", age - 3 - fixDays, crew.name),
        event("resolved", "Administrator verified the repair and closed the report.", age - 4 - fixDays, "Admin User"),
      );
      return report;
    });
  }

  function seedCitizen(citizen) {
    return {
      id: citizen.id,
      name: citizen.name,
      email: citizen.email,
      active: citizen.active,
      password: defaultCitizenPassword,
      createdAt: daysAgo(citizen.joinedDaysAgo || 30),
    };
  }

  function linkSampleReporters(reports) {
    reports.forEach(function (report) {
      if (!report.reporterEmail && sampleReporters[report.reporter]) {
        report.reporterEmail = sampleReporters[report.reporter];
      }
    });
  }

  function createInitialState() {
    const reports = createSampleReports()
      .concat(createAdditionalSubmittedReports())
      .concat(createHistoricalReports());
    linkSampleReporters(reports);
    return {
      reports: reports,
      personnel: personnel.map(function (person) {
        return Object.assign({}, person);
      }),
      citizens: citizens.concat(additionalCitizens).map(seedCitizen),
      personnelSequence: 0,
      citizenSequence: 0,
      sampleReportDatesVersion: 3,
      sampleReportStatusVersion: 1,
      sampleReviewReportsVersion: 2,
      sampleHistoryVersion: 1,
      sampleReporterVersion: 1,
    };
  }

  function isQuotaError(error) {
    return (
      error &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        error.code === 22 ||
        error.code === 1014)
    );
  }

  function saveState(state) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.error("Could not save ResQRoad data.", error);
      const saveError = new Error(
        isQuotaError(error)
          ? "This browser's storage is full. Remove some photos or reset the demo data, then try again."
          : "Could not save changes in this browser. Check browser storage settings and try again.",
      );
      saveError.code = isQuotaError(error) ? "quota" : "storage";
      throw saveError;
    }
  }

  // Applies the upgrades that bring data saved by earlier builds up to date.
  function migrate(state) {
    let needsSave = false;

    if (!Array.isArray(state.citizens)) {
      state.citizens = citizens.map(seedCitizen);
      needsSave = true;
    }
    if (!Number.isInteger(state.personnelSequence) || state.personnelSequence < 0) {
      state.personnelSequence = state.personnel.reduce(function (highest, person) {
        const match = /^road-worker-(\d+)$/.exec(person.id);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0);
      needsSave = true;
    }
    if (!Number.isInteger(state.citizenSequence) || state.citizenSequence < 0) {
      state.citizenSequence = state.citizens.reduce(function (highest, citizen) {
        const match = /^citizen-(\d+)$/.exec(citizen.id);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0);
      needsSave = true;
    }
    if (state.sampleReportStatusVersion !== 1) {
      const testReport = state.reports.find(function (report) {
        return report.id === "RPT-1048";
      });
      if (testReport) {
        testReport.status = "submitted";
        testReport.assignedTo = null;
        testReport.assignedName = null;
        testReport.repair = null;
        testReport.history = [event("submitted", "Report received from a citizen.", 0)];
      }
      state.sampleReportStatusVersion = 1;
      needsSave = true;
    }
    if (state.sampleReviewReportsVersion !== 2) {
      const initialReviewReport = state.reports.find(function (report) {
        return report.id === "RPT-1048";
      });
      if (initialReviewReport) {
        initialReviewReport.status = "submitted";
        initialReviewReport.assignedTo = null;
        initialReviewReport.assignedName = null;
        initialReviewReport.repair = null;
        initialReviewReport.history = [event("submitted", "Report received from a citizen.", 0)];
      }
      const existingIds = new Set(
        state.reports.map(function (report) {
          return report.id;
        }),
      );
      createAdditionalSubmittedReports().forEach(function (report) {
        if (!existingIds.has(report.id)) {
          state.reports.push(report);
        }
      });
      state.sampleReviewReportsVersion = 2;
      needsSave = true;
    }
    // v3: sample report dates and their seeded history now agree.
    if (state.sampleReportDatesVersion !== 3) {
      state.reports.forEach(function (report) {
        const timeline = sampleTimelines[report.id];
        if (!timeline) {
          return;
        }
        report.reportedAt = daysAgo(timeline.reported);
        (report.history || []).forEach(function (item) {
          if (item.actor === "ResQRoad" && Object.prototype.hasOwnProperty.call(timeline.events, item.status)) {
            item.at = daysAgo(timeline.events[item.status]);
          }
        });
        if (report.repair && report.history) {
          const submitted = report.history.find(function (item) {
            return item.status === "repair_submitted" && item.actor === "ResQRoad";
          });
          if (submitted) {
            report.repair.submittedAt = submitted.at;
          }
        }
      });
      state.sampleReportDatesVersion = 3;
      needsSave = true;
    }
    if (state.sampleHistoryVersion !== 1) {
      const existingIds = new Set(
        state.reports.map(function (report) {
          return report.id;
        }),
      );
      createHistoricalReports().forEach(function (report) {
        if (!existingIds.has(report.id)) {
          state.reports.push(report);
        }
      });
      state.sampleHistoryVersion = 1;
      needsSave = true;
    }
    if (state.sampleReporterVersion !== 1) {
      const knownEmails = new Set(
        state.citizens.map(function (citizen) {
          return citizen.email.toLowerCase();
        }),
      );
      additionalCitizens.forEach(function (citizen) {
        if (!knownEmails.has(citizen.email)) {
          state.citizens.push(seedCitizen(citizen));
        }
      });
      state.citizens.forEach(function (citizen) {
        const seed = citizens.concat(additionalCitizens).find(function (item) {
          return item.id === citizen.id;
        });
        if (!citizen.password) {
          citizen.password = defaultCitizenPassword;
        }
        if (!citizen.createdAt) {
          citizen.createdAt = daysAgo(seed ? seed.joinedDaysAgo : 30);
        }
      });
      linkSampleReporters(state.reports);
      state.sampleReporterVersion = 1;
      needsSave = true;
    }

    state.personnel.forEach(function (person) {
      const matchingSeed = personnel.find(function (seed) {
        return seed.id === person.id;
      });
      if (!person.email && matchingSeed) {
        person.email = matchingSeed.email;
        needsSave = true;
      }
      if (person.email && /@roadwatch\.demo$/i.test(person.email)) {
        person.email = person.email.replace(/@roadwatch\.demo$/i, "@resqroad.ph");
        needsSave = true;
      }
    });

    return needsSave;
  }

  function getState() {
    let savedState;

    try {
      savedState = localStorage.getItem(storageKey);
    } catch (error) {
      console.error("Could not access ResQRoad data.", error);
      throw new Error(
        "Browser storage is unavailable. Open the site through a local web server and allow browser storage.",
      );
    }

    if (savedState === null) {
      const initialState = createInitialState();
      saveState(initialState);
      return initialState;
    }

    let state;
    try {
      state = JSON.parse(savedState);
      if (!state || !Array.isArray(state.reports) || !Array.isArray(state.personnel)) {
        throw new Error("Saved data has an unexpected format.");
      }
    } catch (error) {
      console.error("Could not read ResQRoad data.", error);
      throw new Error(
        "Saved data could not be read. Reset the demo data or clear this site's browser storage to restore the default reports.",
      );
    }

    if (migrate(state)) {
      saveState(state);
    }
    return state;
  }

  function addHistory(report, status, description, actor, note) {
    const entry = {
      status: status,
      description: description,
      actor: actor,
      at: new Date().toISOString(),
    };
    if (note) {
      entry.note = note;
    }
    report.history.push(entry);
    return entry;
  }

  function findReport(state, reportId) {
    return state.reports.find(function (item) {
      return item.id === reportId;
    });
  }

  function updateReport(reportId, actor, update) {
    const state = getState();
    const report = findReport(state, reportId);

    if (!report) {
      throw new Error("This report is no longer available.");
    }

    update(report, state);
    saveState(state);
    return report;
  }

  function getReport(reportId) {
    const normalized = String(reportId || "").trim().toUpperCase();
    return findReport(getState(), normalized) || null;
  }

  function setStatus(reportId, status, description, actor, note) {
    if (!Object.prototype.hasOwnProperty.call(statuses, status)) {
      throw new Error("Choose a valid report status.");
    }

    return updateReport(reportId, actor, function (report) {
      report.status = status;
      addHistory(report, status, description, actor, note ? String(note).trim() : "");
    });
  }

  function addNote(reportId, text, actor) {
    const note = String(text || "").trim();
    if (!note) {
      throw new Error("Write a note before saving it.");
    }
    if (note.length > 1000) {
      throw new Error("Keep notes under 1,000 characters.");
    }
    return updateReport(reportId, actor, function (report) {
      addHistory(report, "note", "Added an internal note.", actor, note);
    });
  }

  function normalizePhotos(photos) {
    return (photos || [])
      .map(function (photo) {
        if (typeof photo === "string") {
          return photo;
        }
        if (photo && typeof photo.name === "string") {
          return photo.src ? { name: photo.name, src: String(photo.src) } : photo.name;
        }
        return null;
      })
      .filter(Boolean);
  }

  function stripPhotoData(photos) {
    return (photos || []).map(function (photo) {
      return typeof photo === "string" ? photo : photo.name;
    });
  }

  // Saves the state; if the browser is out of space, keeps the photo file
  // names but drops the image data for `report` and tries once more.
  function saveWithPhotoFallback(state, report, photoKeys) {
    try {
      saveState(state);
      return false;
    } catch (error) {
      if (error.code !== "quota") {
        throw error;
      }
      photoKeys.forEach(function (key) {
        const holder = key.indexOf(".") > 0 ? report[key.split(".")[0]] : report;
        const field = key.indexOf(".") > 0 ? key.split(".")[1] : key;
        if (holder && holder[field]) {
          holder[field] = stripPhotoData(holder[field]);
        }
      });
      saveState(state);
      return true;
    }
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  function emailInUse(state, email) {
    return (
      email === adminEmail ||
      state.personnel.some(function (person) {
        return person.email && person.email.toLowerCase() === email;
      }) ||
      state.citizens.some(function (citizen) {
        return citizen.email.toLowerCase() === email;
      })
    );
  }

  function addReport(input) {
    const title = String(input.title || "").trim();
    const road = String(input.road || "").trim();
    const location = String(input.location || "").trim();
    const description = String(input.description || "").trim();
    const latitude = Number(input.latitude);
    const longitude = Number(input.longitude);
    const severity = input.severity;
    const evidencePhotos = normalizePhotos(input.evidencePhotos);

    const state = getState();
    let citizen = null;
    if (input.reporterId) {
      citizen = state.citizens.find(function (item) {
        return item.id === input.reporterId;
      });
      if (!citizen) {
        throw new Error("Your citizen account is no longer available. Sign in again.");
      }
      if (citizen.active === false) {
        throw new Error("Your account has been deactivated. Contact the Road Maintenance Office to reactivate it.");
      }
    }
    const reporter = citizen ? citizen.name : String(input.reporter || "").trim();

    if (!reporter || !title || !road || !location || !description) {
      throw new Error("Complete all required report fields before submitting.");
    }
    if (!["Low", "Medium", "High"].includes(severity)) {
      throw new Error("Choose a valid report severity.");
    }
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < 14.5 ||
      latitude > 15.2 ||
      longitude < 120.3 ||
      longitude > 121.2
    ) {
      throw new Error("Enter valid GPS coordinates for Bulacan.");
    }
    if (evidencePhotos.length > 5) {
      throw new Error("Choose no more than five evidence photos.");
    }

    // A pothole can come back after a repair, so only open reports count.
    const duplicate = state.reports.find(function (report) {
      return (
        openStatuses.includes(report.status) &&
        Math.abs(report.coordinates.lat - latitude) < 0.001 &&
        Math.abs(report.coordinates.lng - longitude) < 0.001
      );
    });
    if (duplicate) {
      const error = new Error(
        "A report already exists very close to this location (" +
          duplicate.id +
          "). Check the map before adding another report.",
      );
      error.duplicateId = duplicate.id;
      throw error;
    }

    const nextNumber =
      state.reports.reduce(function (highest, report) {
        const match = /^RPT-(\d+)$/.exec(report.id);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 1000) + 1;
    const report = {
      id: "RPT-" + nextNumber,
      title: title,
      road: road,
      location: location,
      coordinates: { lat: Math.round(latitude * 1e6) / 1e6, lng: Math.round(longitude * 1e6) / 1e6 },
      severity: severity,
      description: description,
      reporter: reporter,
      reporterId: citizen ? citizen.id : null,
      reporterEmail: citizen ? citizen.email : null,
      reportedAt: new Date().toISOString(),
      evidencePhotos: evidencePhotos,
      status: "submitted",
      assignedTo: null,
      repair: null,
      history: [],
    };
    addHistory(report, "submitted", "Report received from a citizen.", reporter);
    state.reports.unshift(report);
    report.photosTrimmed = saveWithPhotoFallback(state, report, ["evidencePhotos"]);
    if (!report.photosTrimmed) {
      delete report.photosTrimmed;
    }
    return report;
  }

  function addPersonnel(input) {
    const name = String(input.name || "").trim();
    const email = String(input.email || "").trim().toLowerCase();
    const team = String(input.team || "").trim();
    if (!name || !email || !team) {
      throw new Error("Enter a name, email, and maintenance team.");
    }
    if (!isEmail(email)) {
      throw new Error("Enter a valid email address.");
    }

    const state = getState();
    if (emailInUse(state, email)) {
      throw new Error("An account already uses this email.");
    }

    state.personnelSequence += 1;
    const person = {
      id: "road-worker-" + state.personnelSequence,
      name: name,
      email: email,
      team: team,
      createdAt: new Date().toISOString(),
    };
    state.personnel.push(person);
    saveState(state);
    return person;
  }

  function deletePersonnel(personnelId) {
    const state = getState();
    const person = state.personnel.find(function (item) {
      return item.id === personnelId;
    });
    if (!person) {
      throw new Error("This maintenance account is no longer available.");
    }

    const hasOpenAssignments = state.reports.some(function (report) {
      return report.assignedTo === personnelId && crewOpenStatuses.includes(report.status);
    });
    if (hasOpenAssignments) {
      throw new Error("Reassign or finish this person's open jobs before deleting the account.");
    }

    state.reports.forEach(function (report) {
      if (report.assignedTo === personnelId) {
        report.assignedName = person.name;
      }
    });
    state.personnel = state.personnel.filter(function (item) {
      return item.id !== personnelId;
    });
    saveState(state);
    return person;
  }

  function registerCitizen(input) {
    const name = String(input.name || "").trim().replace(/\s+/g, " ");
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");

    if (name.length < 2) {
      throw new Error("Enter your full name.");
    }
    if (name.length > 80) {
      throw new Error("Keep your name under 80 characters.");
    }
    if (!isEmail(email)) {
      throw new Error("Enter a valid email address.");
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new Error("Use at least 8 characters with a letter and a number.");
    }

    const state = getState();
    if (emailInUse(state, email)) {
      throw new Error("An account already uses this email. Sign in instead.");
    }

    state.citizenSequence += 1;
    const citizen = {
      id: "citizen-" + state.citizenSequence,
      name: name,
      email: email,
      active: true,
      password: password,
      createdAt: new Date().toISOString(),
    };
    state.citizens.push(citizen);
    saveState(state);
    return citizen;
  }

  function setCitizenActive(citizenId, active) {
    const state = getState();
    const citizen = state.citizens.find(function (item) {
      return item.id === citizenId;
    });
    if (!citizen) {
      throw new Error("This citizen account is no longer available.");
    }

    citizen.active = Boolean(active);
    saveState(state);
    return citizen;
  }

  function assignReport(reportId, personnelId) {
    return updateReport(reportId, "Administrator", function (report, state) {
      if (report.status !== "verified" && report.status !== "assigned") {
        throw new Error("Verify this report before assigning maintenance personnel.");
      }

      const assignedPerson = state.personnel.find(function (person) {
        return person.id === personnelId;
      });

      if (!assignedPerson) {
        throw new Error("Choose an available maintenance person.");
      }

      report.assignedTo = assignedPerson.id;
      report.assignedName = assignedPerson.name;
      report.status = "assigned";
      addHistory(report, "assigned", "Assigned to " + assignedPerson.name + ".", "Administrator");
    });
  }

  function startRepair(reportId, personnelId) {
    return updateReport(reportId, personnelId, function (report, state) {
      if (report.assignedTo !== personnelId || report.status !== "assigned") {
        throw new Error("This job is no longer assigned to you.");
      }

      const person = state.personnel.find(function (item) {
        return item.id === personnelId;
      });
      report.status = "in_progress";
      addHistory(report, "in_progress", "Repair work started.", person ? person.name : "Maintenance personnel");
    });
  }

  function submitRepair(reportId, personnelId, repair) {
    const state = getState();
    const report = findReport(state, reportId);
    if (!report) {
      throw new Error("This report is no longer available.");
    }
    if (report.assignedTo !== personnelId || report.status !== "in_progress") {
      throw new Error("This repair is no longer assigned to you.");
    }

    const person = state.personnel.find(function (item) {
      return item.id === personnelId;
    });
    report.status = "repair_submitted";
    report.repair = {
      notes: String(repair.notes || "").trim(),
      beforePhotos: normalizePhotos(repair.beforePhotos),
      afterPhotos: normalizePhotos(repair.afterPhotos),
      submittedAt: new Date().toISOString(),
    };
    addHistory(
      report,
      "repair_submitted",
      "Repair submitted for admin verification.",
      person ? person.name : "Maintenance personnel",
    );
    report.photosTrimmed = saveWithPhotoFallback(state, report, ["repair.beforePhotos", "repair.afterPhotos"]);
    if (!report.photosTrimmed) {
      delete report.photosTrimmed;
    }
    return report;
  }

  // Full name for a report's citizen, from the linked account when there is one.
  function reporterName(report, state) {
    const currentState = state || getState();
    if (report.reporterEmail) {
      const citizen = currentState.citizens.find(function (item) {
        return item.email.toLowerCase() === String(report.reporterEmail).toLowerCase();
      });
      if (citizen) {
        return citizen.name;
      }
    }
    return report.reporter;
  }

  function reportsByCitizen(citizen, state) {
    const currentState = state || getState();
    const email = citizen.email.toLowerCase();
    return currentState.reports.filter(function (report) {
      return (
        report.reporterId === citizen.id ||
        (report.reporterEmail && String(report.reporterEmail).toLowerCase() === email)
      );
    });
  }

  function resetDemoData() {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Could not reset ResQRoad data.", error);
      throw new Error("Could not reset the demo data in this browser.");
    }
  }

  // Calls `callback` when another tab changes the shared data.
  function onExternalChange(callback) {
    window.addEventListener("storage", function (event) {
      if (event.key === storageKey || event.key === null) {
        callback();
      }
    });
  }

  window.RoadWatchStore = {
    storageKey: storageKey,
    getState: getState,
    getReport: getReport,
    statuses: statuses,
    openStatuses: openStatuses,
    closedStatuses: closedStatuses,
    crewOpenStatuses: crewOpenStatuses,
    setStatus: setStatus,
    addNote: addNote,
    addReport: addReport,
    addPersonnel: addPersonnel,
    deletePersonnel: deletePersonnel,
    registerCitizen: registerCitizen,
    setCitizenActive: setCitizenActive,
    assignReport: assignReport,
    startRepair: startRepair,
    submitRepair: submitRepair,
    reporterName: reporterName,
    reportsByCitizen: reportsByCitizen,
    resetDemoData: resetDemoData,
    onExternalChange: onExternalChange,
  };
})();
