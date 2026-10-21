/* Landing page: live numbers, the hero product preview, the public report
   map, and the "recently fixed" list, all built from the shared data. Only
   public details are shown — never reporter names or internal notes. */
(async function () {
  "use strict";

  const store = window.RoadWatchStore;
  const ui = window.RoadWatchUI;
  const icon = ui.icon;
  const esc = ui.escapeHtml;
  const publicStatuses = ["verified", "assigned", "in_progress", "repair_submitted", "resolved"];
  const progressByStatus = {
    submitted: 12,
    under_review: 26,
    verified: 42,
    assigned: 58,
    in_progress: 74,
    repair_submitted: 88,
    resolved: 100,
  };
  const severityColor = { High: "#d9443a", Medium: "#d9961e", Low: "#2f9461" };

  let state;
  try {
    await store.ready();
    state = store.getState();
  } catch (error) {
    console.error("Could not load ResQRoad data.", error);
    ui.showMessage(error.message, "error");
    return;
  }

  function resolvedAt(report) {
    const event = (report.history || []).slice().reverse().find(function (item) {
      return item.status === "resolved";
    });
    return event ? event.at : null;
  }

  const resolved = state.reports
    .filter(function (report) {
      return report.status === "resolved" && resolvedAt(report);
    })
    .sort(function (first, second) {
      return Date.parse(resolvedAt(second)) - Date.parse(resolvedAt(first));
    });
  const fixDays = resolved.map(function (report) {
    return ui.daysBetween(report.reportedAt, resolvedAt(report));
  });
  const averageFix = fixDays.length
    ? fixDays.reduce(function (sum, value) {
        return sum + value;
      }, 0) / fixDays.length
    : null;

  /* ---------- Hero numbers ---------- */

  const stats = {
    "stat-reports": state.reports.length,
    "stat-fixed": resolved.length,
    "stat-crews": state.personnel.length,
  };
  Object.keys(stats).forEach(function (id) {
    document.getElementById(id).dataset.countUp = String(stats[id]);
  });
  document.getElementById("stat-days").innerHTML =
    averageFix == null ? "—" : esc(ui.formatNumber(averageFix, 1)) + "<small>days</small>";

  function countUp(element) {
    const target = Number(element.dataset.countUp || 0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || target === 0) {
      element.textContent = String(target);
      return;
    }
    const start = performance.now();
    const duration = 1100;
    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.round(target * eased));
      if (progress < 1) {
        window.requestAnimationFrame(frame);
      }
    }
    window.requestAnimationFrame(frame);
  }

  const counters = document.querySelectorAll("[data-count-up]");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          countUp(entry.target);
          observer.unobserve(entry.target);
        }
      });
    });
    counters.forEach(function (element) {
      observer.observe(element);
    });
  } else {
    counters.forEach(countUp);
  }

  /* ---------- Hero preview ---------- */

  const featured =
    state.reports
      .filter(function (report) {
        return store.openStatuses.includes(report.status) && report.severity === "High";
      })
      .sort(function (first, second) {
        return Date.parse(second.reportedAt) - Date.parse(first.reportedAt);
      })[0] || state.reports[0];
  if (featured) {
    document.getElementById("hero-report-photo").src = ui.reportPhotos(featured)[0].src;
    document.getElementById("hero-report-id").textContent = featured.id + " · " + featured.severity + " severity";
    document.getElementById("hero-report-title").textContent = featured.title;
    document.getElementById("hero-report-status").innerHTML = ui.statusPill(featured.status);
    document.getElementById("hero-report-progress").style.setProperty("--progress", (progressByStatus[featured.status] || 20) + "%");
  }
  if (resolved[0]) {
    const days = Math.max(1, Math.round(ui.daysBetween(resolved[0].reportedAt, resolvedAt(resolved[0]))));
    document.getElementById("hero-toast-title").textContent = resolved[0].id + " repaired";
    document.getElementById("hero-toast-text").textContent = "Fixed in " + ui.pluralize(days, "day") + " · " + resolved[0].road;
  }

  // Pins on the stylized hero map, placed with the same Bulacan bounds as
  // the schematic map.
  const bounds = { north: 14.94, south: 14.82, west: 120.75, east: 121.0 };
  document.getElementById("hero-map").insertAdjacentHTML(
    "beforeend",
    state.reports
      .filter(function (report) {
        return report.coordinates;
      })
      .slice(0, 14)
      .map(function (report, index) {
        const x = ((report.coordinates.lng - bounds.west) / (bounds.east - bounds.west)) * 100;
        const y = ((bounds.north - report.coordinates.lat) / (bounds.north - bounds.south)) * 100;
        return (
          '<span class="preview-pin" style="left:' +
          Math.max(6, Math.min(94, x)).toFixed(1) +
          "%;top:" +
          Math.max(14, Math.min(96, y)).toFixed(1) +
          "%;animation-delay:" +
          (300 + index * 90) +
          'ms"><svg viewBox="0 0 28 36"><path class="pin-shape" fill="' +
          severityColor[report.severity] +
          '" d="M26.5 13.5c0 9-12.5 22.5-12.5 22.5S1.5 22.5 1.5 13.5a12.5 12.5 0 1 1 25 0Z"/><circle class="pin-dot" cx="14" cy="13.5" r="4.5"/></svg></span>'
        );
      })
      .join(""),
  );

  /* ---------- Live map ---------- */

  const publicReports = state.reports.filter(function (report) {
    return publicStatuses.includes(report.status);
  });
  ui.renderMap(document.getElementById("public-map"), publicReports, {
    emptyMessage: "No verified reports yet.",
    action: "track",
    actionLabel: "Follow this report",
    onAction: function (action, reportId) {
      window.location.href = "track.html?id=" + encodeURIComponent(reportId);
    },
    pulse: function (report) {
      return report.severity === "High" && report.status !== "resolved";
    },
  });
  document.getElementById("public-legend").innerHTML = ui.mapLegend();

  const tiles = [
    { label: "Under review", statuses: ["submitted", "under_review"], tone: "var(--st-under_review)" },
    { label: "Scheduled", statuses: ["verified", "assigned"], tone: "var(--st-verified)" },
    { label: "Being repaired", statuses: ["in_progress", "repair_submitted"], tone: "var(--st-in_progress)" },
    { label: "Fixed", statuses: ["resolved"], tone: "var(--st-resolved)" },
  ];
  document.getElementById("status-strip").innerHTML = tiles
    .map(function (tile) {
      const count = state.reports.filter(function (report) {
        return tile.statuses.includes(report.status);
      }).length;
      return (
        '<div class="status-tile"><strong>' +
        count +
        '</strong><span><i class="pill-dot" style="background:' +
        tile.tone +
        '"></i>' +
        esc(tile.label) +
        "</span></div>"
      );
    })
    .join("");

  document.getElementById("fixed-list").innerHTML = resolved.length
    ? resolved
        .slice(0, 4)
        .map(function (report) {
          return (
            '<li class="fixed-item"><span class="check">' +
            icon("check") +
            '</span><a href="track.html?id=' +
            encodeURIComponent(report.id) +
            '" style="text-decoration: none; min-width: 0"><strong>' +
            esc(report.title) +
            "</strong><span>" +
            esc(report.road + " · fixed " + ui.relativeTime(resolvedAt(report))) +
            "</span></a></li>"
          );
        })
        .join("")
    : '<li class="muted text-sm">No repairs completed yet.</li>';

  document.getElementById("track-form").addEventListener("submit", function (event) {
    const input = event.target.elements.namedItem("id");
    input.value = input.value.trim().toUpperCase();
  });
})();
