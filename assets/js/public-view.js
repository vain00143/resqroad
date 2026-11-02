/* The public side of ResQRoad, shown inside every workspace so nobody has to
   leave it: the "Public site" page (live numbers, the public report map,
   report progress, recent repairs, and how it works), plus the report
   tracking card shared by the public tracker and the resident portal. Only
   public details are shown, never reporter names or internal notes. */
(function () {
  "use strict";

  const ui = window.RoadWatchUI;
  const icon = ui.icon;
  const esc = ui.escapeHtml;

  // Reports the public map shows: confirmed by the office, through to fixed.
  const publicStatuses = ["verified", "assigned", "in_progress", "repair_submitted", "resolved"];

  const plainStatus = {
    submitted: "Your report was received and is waiting for review.",
    under_review: "The Road Maintenance Office is reviewing the report.",
    verified: "The damage was confirmed and is waiting for a repair crew.",
    assigned: "A maintenance crew has been assigned to repair it.",
    in_progress: "A crew is repairing the road.",
    repair_submitted: "The crew finished the repair; it's being checked by the office.",
    resolved: "The repair was verified. This road damage is fixed.",
    rejected: "The office closed this report without a repair.",
    duplicate: "This was already reported, so it's being handled under another report.",
  };

  const progressGroups = [
    { label: "Under review", statuses: ["submitted", "under_review"], tone: "var(--st-under_review)" },
    { label: "Scheduled", statuses: ["verified", "assigned"], tone: "var(--st-verified)" },
    { label: "Being repaired", statuses: ["in_progress", "repair_submitted"], tone: "var(--st-in_progress)" },
    { label: "Fixed", statuses: ["resolved"], tone: "var(--st-resolved)" },
  ];

  const steps = [
    { icon: "camera", title: "Report", text: "A resident pins the damage on the map, describes it, and adds photos." },
    { icon: "shield-check", title: "Verify", text: "The Road Maintenance Office checks for duplicates and confirms the damage." },
    { icon: "hard-hat", title: "Repair", text: "A road crew is assigned, fixes the road, and sends photos of the finished work." },
    { icon: "check-circle", title: "Resolve", text: "The office verifies the repair and closes the report for everyone to see." },
  ];

  function store() {
    return window.RoadWatchStore;
  }

  function resolvedAt(report) {
    const event = (report.history || []).slice().reverse().find(function (item) {
      return item.status === "resolved";
    });
    return event ? event.at : null;
  }

  // The time of the latest public update (internal notes don't count).
  function lastUpdate(report) {
    const entries = (report.history || []).filter(function (entry) {
      return entry.status !== "note";
    });
    return entries.length ? entries[entries.length - 1].at : report.reportedAt;
  }

  function publicReports(state) {
    return state.reports.filter(function (report) {
      return publicStatuses.includes(report.status);
    });
  }

  function fixedReports(state) {
    return state.reports
      .filter(function (report) {
        return report.status === "resolved" && resolvedAt(report);
      })
      .sort(function (first, second) {
        return Date.parse(resolvedAt(second)) - Date.parse(resolvedAt(first));
      });
  }

  /* ---------- Public site page ---------- */

  function cardHead(id, iconName, title, subtitle) {
    return (
      '<div class="card-header"><div><h2 class="card-title" id="' +
      id +
      '">' +
      icon(iconName) +
      esc(title) +
      '</h2><p class="card-subtitle">' +
      esc(subtitle) +
      "</p></div></div>"
    );
  }

  function skeleton() {
    return (
      '<div class="grid grid-kpi" data-pv-stats aria-label="Public numbers"></div>' +
      '<div class="grid grid-2-1">' +
      '<section class="card pv-map-card" aria-labelledby="pv-map-title">' +
      cardHead("pv-map-title", "map", "Live map", "Verified road damage across Bulacan, color-coded by severity.") +
      '<div class="card-body"><div class="map pv-map" data-pv-map></div><div data-pv-legend></div></div></section>' +
      '<div class="pv-side">' +
      '<section class="card" aria-labelledby="pv-progress-title">' +
      cardHead("pv-progress-title", "layers", "Report progress", "Where every report stands right now.") +
      '<div class="card-body"><div class="pv-status" data-pv-status></div></div></section>' +
      '<section class="card" aria-labelledby="pv-fixed-title">' +
      cardHead("pv-fixed-title", "check-circle", "Recently fixed", "Repairs verified by the Road Maintenance Office.") +
      '<div class="card-body"><ul class="pv-fixed" data-pv-fixed></ul></div></section>' +
      "</div></div>" +
      '<section class="card pv-how" aria-labelledby="pv-how-title">' +
      cardHead("pv-how-title", "info", "How it works", "Every report follows the same four steps, from pothole to fixed.") +
      '<div class="card-body"><ol class="pv-steps">' +
      steps
        .map(function (step, index) {
          return (
            '<li class="pv-step"><span class="pv-step-icon">' +
            icon(step.icon) +
            '</span><div><span class="pv-step-num">Step ' +
            (index + 1) +
            "</span><h3>" +
            esc(step.title) +
            "</h3><p>" +
            esc(step.text) +
            "</p></div></li>"
          );
        })
        .join("") +
      "</ol></div></section>"
    );
  }

  function kpi(label, value, iconName, tone, foot) {
    return (
      '<div class="card kpi"><span class="kpi-top"><span class="kpi-label">' +
      esc(label) +
      '</span><span class="kpi-icon" style="--tone:' +
      tone +
      '">' +
      icon(iconName) +
      '</span></span><span class="kpi-value">' +
      value +
      '</span><span class="kpi-foot">' +
      esc(foot) +
      "</span></div>"
    );
  }

  // Renders (or refreshes) the public site page in `container`.
  // options: onOpen(reportId, opener) to open a report, canOpen(report)
  // (default: every report), and openLabel for the map popup button.
  function render(container, state, options) {
    const settings = options || {};
    const canOpen = function (report) {
      return Boolean(settings.onOpen) && (!settings.canOpen || settings.canOpen(report));
    };
    if (!container.querySelector("[data-pv-map]")) {
      container.innerHTML = skeleton();
      container.addEventListener("click", function (event) {
        const item = event.target.closest("[data-pv-open]");
        const current = container._pvOptions;
        if (item && current && current.onOpen) {
          current.onOpen(item.dataset.pvOpen, item);
        }
      });
    }
    container._pvOptions = settings;

    const fixed = fixedReports(state);
    const fixDays = fixed.map(function (report) {
      return ui.daysBetween(report.reportedAt, resolvedAt(report));
    });
    const averageFix = fixDays.length
      ? fixDays.reduce(function (sum, value) {
          return sum + value;
        }, 0) / fixDays.length
      : null;
    container.querySelector("[data-pv-stats]").innerHTML = [
      kpi("Reports filed", String(state.reports.length), "clipboard-list", "var(--accent)", "Every report residents have sent"),
      kpi("Repairs completed", String(fixed.length), "check-circle", "var(--success)", "Verified by the Road Maintenance Office"),
      kpi("Average time to fix", ui.durationHtml(averageFix), "timer", "var(--st-in_progress)", "From report to verified repair"),
      kpi("Active road crews", String(state.personnel.length), "hard-hat", "var(--st-assigned)", "Crews working on reported roads"),
    ].join("");

    container.querySelector("[data-pv-status]").innerHTML = progressGroups
      .map(function (group) {
        const count = state.reports.filter(function (report) {
          return group.statuses.includes(report.status);
        }).length;
        return (
          '<div class="pv-status-tile"><strong>' +
          count +
          '</strong><span><i class="pill-dot" style="background:' +
          group.tone +
          '" aria-hidden="true"></i>' +
          esc(group.label) +
          "</span></div>"
        );
      })
      .join("");

    container.querySelector("[data-pv-fixed]").innerHTML = fixed.length
      ? fixed
          .slice(0, 5)
          .map(function (report) {
            const copy =
              '<span class="pv-fixed-check">' +
              icon("check", "icon-sm") +
              '</span><span class="pv-fixed-copy"><strong>' +
              esc(report.title) +
              "</strong><span>" +
              esc(report.id + " · " + report.road + " · fixed " + ui.relativeTime(resolvedAt(report))) +
              "</span></span>";
            return canOpen(report)
              ? '<li><button class="pv-fixed-item" type="button" data-pv-open="' +
                  esc(report.id) +
                  '">' +
                  copy +
                  icon("chevron-right", "icon-sm") +
                  "</button></li>"
              : '<li><div class="pv-fixed-item">' + copy + "</div></li>";
          })
          .join("")
      : '<li class="muted text-sm">No repairs completed yet.</li>';

    const mapReports = publicReports(state);
    const map = ui.renderMap(container.querySelector("[data-pv-map]"), mapReports, {
      emptyMessage: "No verified reports yet.",
      popup: function (report) {
        return ui.reportPopup(
          report,
          canOpen(report) ? { action: "open", actionLabel: settings.openLabel || "View details" } : { action: false },
        );
      },
      onAction: function (action, reportId, button) {
        if (settings.onOpen) {
          settings.onOpen(reportId, button);
        }
      },
      pulse: function (report) {
        return report.severity === "High" && report.status !== "resolved";
      },
    });
    container.querySelector("[data-pv-legend]").innerHTML = ui.mapLegend();
    return map;
  }

  /* ---------- Tracking card ---------- */

  // A report's public progress, as the tracker shows it. The caller draws the
  // map into [data-track-map]. options.headActions: buttons for the header;
  // options.submittedText: how the timeline describes the submitted step.
  function trackCard(report, options) {
    const resolvedTime = resolvedAt(report);
    const age = resolvedTime
      ? "Fixed in " + ui.pluralize(Math.max(1, Math.round(ui.daysBetween(report.reportedAt, resolvedTime))), "day")
      : store().openStatuses.includes(report.status)
        ? "Open for " + ui.pluralize(Math.max(0, Math.floor(ui.daysBetween(report.reportedAt))), "day")
        : "Closed";
    const repairDone = report.status === "resolved" && report.repair;
    const afterPhotos = repairDone ? ui.repairPhotos(report, "after") : [];
    return (
      '<article class="card track-card"><div class="track-result-head"><div><div class="toolbar-group"><span class="id-tag">' +
      esc(report.id) +
      "</span>" +
      ui.statusPill(report.status) +
      ui.severityBadge(report.severity) +
      "</div><h2>" +
      esc(report.title) +
      '</h2><p class="detail-sub" style="margin: 0"><span>' +
      icon("map-pin") +
      esc(report.road + " · " + report.location) +
      "</span><span>" +
      icon("calendar") +
      "Reported " +
      esc(ui.formatDay(report.reportedAt)) +
      "</span></p></div>" +
      ((options && options.headActions) || "") +
      '</div><div class="card-body"><p class="alert alert-brand" style="margin-bottom: 1.25rem">' +
      icon("info") +
      "<span>" +
      esc(plainStatus[report.status] || "Status updated.") +
      '</span></p><div class="journey-card">' +
      ui.journey(report) +
      '</div><div class="track-columns" style="margin-top: 1.5rem"><section><h3 class="section-label">Progress updates</h3>' +
      ui.timeline(report, { publicOnly: true, submittedText: options && options.submittedText }) +
      (repairDone && (report.repair.notes || afterPhotos.length)
        ? '<div class="callout" style="margin-top: 1.25rem"><p class="section-label">What the crew did</p>' +
          (report.repair.notes ? '<p class="detail-description">' + esc(report.repair.notes) + "</p>" : "") +
          (afterPhotos.length
            ? '<div class="repair-photos"><h4>After-repair photos</h4>' +
              ui.photoGallery(afterPhotos, "After-repair photos", "gallery-grid") +
              "</div>"
            : "") +
          "</div>"
        : "") +
      '</section><section class="track-side"><div class="map" data-track-map></div><dl class="facts"><div><dt>Last update</dt><dd>' +
      esc(ui.relativeTime(lastUpdate(report))) +
      "</dd></div><div><dt>Timeline</dt><dd>" +
      esc(age) +
      "</dd></div></dl></section></div></div></article>"
    );
  }

  // "rpt1048", "1048", or " RPT-1048 " all become "RPT-1048".
  function normalizeId(value) {
    let id = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (/^\d+$/.test(id)) {
      id = "RPT-" + id;
    } else if (/^RPT\d+$/.test(id)) {
      id = id.replace(/^RPT/, "RPT-");
    }
    return id;
  }

  window.RoadWatchPublicView = {
    publicStatuses: publicStatuses,
    plainStatus: plainStatus,
    resolvedAt: resolvedAt,
    lastUpdate: lastUpdate,
    publicReports: publicReports,
    render: render,
    trackCard: trackCard,
    normalizeId: normalizeId,
  };
})();
