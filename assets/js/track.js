/* Public report tracker: look a report up by ID and show its public progress.
   Reporter details and internal staff notes are never shown here. */
(async function () {
  "use strict";

  const store = window.RoadWatchStore;
  const ui = window.RoadWatchUI;
  const icon = ui.icon;
  const esc = ui.escapeHtml;
  const recentKey = "resqroad-recent-tracks";
  const form = document.getElementById("track-form");
  const input = document.getElementById("track-input");
  const result = document.getElementById("track-result");
  const recent = document.getElementById("recent-ids");
  let map = null;
  let currentId = "";

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

  function normalize(value) {
    let id = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (/^\d+$/.test(id)) {
      id = "RPT-" + id;
    } else if (/^RPT\d+$/.test(id)) {
      id = id.replace(/^RPT/, "RPT-");
    }
    return id;
  }

  function readRecent() {
    try {
      const list = JSON.parse(localStorage.getItem(recentKey) || "[]");
      return Array.isArray(list) ? list.filter(function (item) {
        return typeof item === "string";
      }) : [];
    } catch (error) {
      return [];
    }
  }

  function saveRecent(id) {
    const list = [id].concat(readRecent().filter(function (item) {
      return item !== id;
    })).slice(0, 5);
    try {
      localStorage.setItem(recentKey, JSON.stringify(list));
    } catch (error) {
      // Recent searches are only a convenience.
    }
    renderRecent();
  }

  function renderRecent() {
    const list = readRecent();
    recent.hidden = list.length === 0;
    recent.innerHTML =
      "<span>Recent:</span>" +
      list
        .map(function (id) {
          return '<button type="button" data-recent="' + esc(id) + '">' + esc(id) + "</button>";
        })
        .join("");
  }

  function lastUpdate(report) {
    const entries = (report.history || []).filter(function (entry) {
      return entry.status !== "note";
    });
    return entries.length ? entries[entries.length - 1].at : report.reportedAt;
  }

  function show(id) {
    if (map) {
      map.destroy();
      map = null;
    }
    currentId = id;
    if (!id) {
      result.innerHTML =
        '<div class="card empty"><span class="empty-icon">' +
        icon("search") +
        "</span><h3>Enter a report ID</h3><p>Report IDs look like RPT-1048. You'll find yours on the confirmation screen and under My reports.</p></div>";
      return;
    }

    let report = null;
    try {
      report = store.getReport(id);
    } catch (error) {
      ui.showMessage(error.message, "error");
      return;
    }
    if (!report) {
      result.innerHTML =
        '<div class="card empty"><span class="empty-icon">' +
        icon("alert-circle") +
        "</span><h3>We couldn't find " +
        esc(id) +
        "</h3><p>Check the ID and try again. Report IDs look like RPT-1048.</p></div>";
      return;
    }

    saveRecent(report.id);
    const resolvedEvent = (report.history || []).slice().reverse().find(function (entry) {
      return entry.status === "resolved";
    });
    const age = resolvedEvent
      ? "Fixed in " + ui.pluralize(Math.max(1, Math.round(ui.daysBetween(report.reportedAt, resolvedEvent.at))), "day")
      : store.openStatuses.includes(report.status)
        ? "Open for " + ui.pluralize(Math.max(0, Math.floor(ui.daysBetween(report.reportedAt))), "day")
        : "Closed";

    result.innerHTML =
      '<article class="card rise-in"><div class="track-result-head"><div><div class="toolbar-group"><span class="id-tag">' +
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
      '</span></p></div><button class="btn btn-secondary btn-sm" type="button" id="copy-link">' +
      icon("copy", "icon-sm") +
      'Copy link</button></div><div class="card-body"><p class="alert alert-brand" style="margin-bottom: 1.25rem">' +
      icon("info") +
      "<span>" +
      esc(plainStatus[report.status] || "Status updated.") +
      '</span></p><div class="journey-card">' +
      ui.journey(report) +
      '</div><div class="track-columns" style="margin-top: 1.5rem"><section><h3 class="section-label">Progress updates</h3>' +
      ui.timeline(report, { publicOnly: true }) +
      (report.status === "resolved" && report.repair && report.repair.notes
        ? '<div class="callout" style="margin-top: 1.25rem"><p class="section-label">What the crew did</p><p class="detail-description">' +
          esc(report.repair.notes) +
          "</p></div>"
        : "") +
      '</section><section><div class="map" id="track-map"></div><dl class="facts" style="margin-top: 1rem"><div><dt>Last update</dt><dd>' +
      esc(ui.relativeTime(lastUpdate(report))) +
      "</dd></div><div><dt>Timeline</dt><dd>" +
      esc(age) +
      "</dd></div></dl></section></div></div></article>";

    map = ui.renderMap(document.getElementById("track-map"), [report], {
      popup: false,
      zoom: 15,
      emptyMessage: "Location unavailable.",
    });
    document.title = report.id + " · " + ui.statusLabel(report.status) + " | ResQRoad";
  }

  function lookup(value, updateUrl) {
    const id = normalize(value);
    input.value = id;
    if (updateUrl) {
      history.replaceState(null, "", id ? "?id=" + encodeURIComponent(id) : window.location.pathname);
    }
    show(id);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    lookup(input.value, true);
  });

  recent.addEventListener("click", function (event) {
    const button = event.target.closest("[data-recent]");
    if (button) {
      lookup(button.dataset.recent, true);
    }
  });

  result.addEventListener("click", function (event) {
    if (!event.target.closest("#copy-link")) {
      return;
    }
    const link = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(
        function () {
          ui.showMessage("Tracking link copied.", "success");
        },
        function () {
          ui.showMessage(link, "info");
        },
      );
    } else {
      ui.showMessage(link, "info");
    }
  });

  // Status changes made in another tab show up right away.
  store.onExternalChange(function () {
    if (currentId) {
      show(currentId);
    }
  });

  renderRecent();
  await store.ready();
  const initial = new URLSearchParams(window.location.search).get("id");
  if (initial) {
    lookup(initial, false);
  } else {
    show("");
  }
})();
