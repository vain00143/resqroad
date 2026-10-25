/* Landing page: live numbers, the hero product preview, the public report
   map, the "recently fixed" list, and the report tracker at the bottom of
   the page, all built from the shared data. Only public details are shown —
   never reporter names or internal notes. */
(async function () {
  "use strict";

  const store = window.RoadWatchStore;
  const ui = window.RoadWatchUI;
  const publicView = window.RoadWatchPublicView;
  const icon = ui.icon;
  const esc = ui.escapeHtml;
  const recentKey = "resqroad-recent-tracks";
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
  const severityColor = { High: "#d9362b", Medium: "#e8771a", Low: "#e3b100" };

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
  document.getElementById("stat-days").innerHTML = ui.durationHtml(averageFix);

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
      track(reportId, { scroll: true });
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
        .slice(0, 5)
        .map(function (report) {
          return (
            '<li class="fixed-item"><span class="check">' +
            icon("check") +
            '</span><a href="?track=' +
            encodeURIComponent(report.id) +
            '#track" data-track-report="' +
            esc(report.id) +
            '" style="text-decoration: none; min-width: 0"><strong>' +
            esc(report.title) +
            "</strong><span>" +
            esc(report.road + " · fixed " + ui.relativeTime(resolvedAt(report))) +
            "</span></a></li>"
          );
        })
        .join("")
    : '<li class="muted text-sm">No repairs completed yet.</li>';

  /* ---------- Track a report ---------- */

  // The tracker lives at the bottom of this page (#track): look a report up
  // by ID and see its public progress. Addresses like ?track=RPT-1048#track
  // (shared tracking links) open it straight away.
  const trackForm = document.getElementById("track-form");
  const trackInput = trackForm.elements.namedItem("id");
  const trackResult = document.getElementById("track-result");
  const recentBox = document.getElementById("track-recent");
  let trackMap = null;
  let trackedId = "";

  function readRecent() {
    try {
      const list = JSON.parse(localStorage.getItem(recentKey) || "[]");
      return Array.isArray(list)
        ? list.filter(function (item) {
            return typeof item === "string";
          })
        : [];
    } catch (error) {
      return [];
    }
  }

  function saveRecent(id) {
    const list = [id]
      .concat(
        readRecent().filter(function (item) {
          return item !== id;
        }),
      )
      .slice(0, 5);
    try {
      localStorage.setItem(recentKey, JSON.stringify(list));
    } catch (error) {
      // Recent searches are only a convenience.
    }
  }

  function renderRecent() {
    const list = readRecent();
    recentBox.hidden = list.length === 0;
    recentBox.innerHTML =
      "<span>Recent:</span>" +
      list
        .map(function (id) {
          return '<button type="button" data-recent="' + esc(id) + '" aria-pressed="' + String(id === trackedId) + '">' + esc(id) + "</button>";
        })
        .join("");
  }

  function renderTracked() {
    if (trackMap) {
      trackMap.destroy();
      trackMap = null;
    }
    if (!trackedId) {
      trackResult.innerHTML = "";
      return;
    }
    const report = store.getReport(trackedId);
    if (!report) {
      trackResult.innerHTML =
        '<div class="card empty"><span class="empty-icon">' +
        icon("alert-circle") +
        "</span><h3>We couldn't find " +
        esc(trackedId) +
        "</h3><p>Check the ID and try again. Report IDs look like RPT-1048.</p></div>";
      return;
    }
    trackResult.innerHTML = publicView.trackCard(report, {
      headActions:
        '<button class="btn btn-secondary btn-sm" type="button" data-copy-link>' + icon("copy", "icon-sm") + "Copy link</button>",
    });
    trackMap = ui.renderMap(trackResult.querySelector("[data-track-map]"), [report], {
      popup: false,
      zoom: 15,
      emptyMessage: "Location unavailable.",
    });
  }

  // Shows a report in the tracker. options.scroll brings the tracker into
  // view (from the map or the Recently fixed list).
  function track(value, options) {
    const id = publicView.normalizeId(value);
    trackedId = id;
    trackInput.value = id;
    const report = id ? store.getReport(id) : null;
    if (report) {
      saveRecent(report.id);
    }
    history.replaceState(null, "", (id ? "?track=" + encodeURIComponent(id) : window.location.pathname) + "#track");
    renderRecent();
    renderTracked();
    if (options && options.scroll) {
      document.getElementById("track").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  trackForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!publicView.normalizeId(trackInput.value)) {
      trackInput.focus();
      trackResult.innerHTML =
        '<div class="card empty"><span class="empty-icon">' +
        icon("search") +
        "</span><h3>Enter a report ID</h3><p>Report IDs look like RPT-1048. You'll find yours on the confirmation screen and under My reports.</p></div>";
      return;
    }
    track(trackInput.value);
  });

  recentBox.addEventListener("click", function (event) {
    const chip = event.target.closest("[data-recent]");
    if (chip) {
      track(chip.dataset.recent);
    }
  });

  document.getElementById("fixed-list").addEventListener("click", function (event) {
    const link = event.target.closest("[data-track-report]");
    if (link && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault();
      track(link.dataset.trackReport, { scroll: true });
    }
  });

  trackResult.addEventListener("click", function (event) {
    const photo = event.target.closest("[data-gallery-index]");
    if (photo) {
      const images = Array.from(photo.closest("[data-gallery-group]").querySelectorAll("img")).map(function (image) {
        return { src: image.currentSrc || image.src, alt: image.alt };
      });
      ui.openLightbox(images, Number(photo.dataset.galleryIndex), photo);
      return;
    }
    if (!event.target.closest("[data-copy-link]") || !trackedId) {
      return;
    }
    const link = new URL("index.html?track=" + encodeURIComponent(trackedId) + "#track", window.location.href).href;
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

  // Status changes made by the office show up right away.
  store.onExternalChange(function () {
    if (trackedId) {
      renderTracked();
    }
  });

  renderRecent();
  const linked = new URLSearchParams(window.location.search).get("track");
  if (linked) {
    track(linked, { scroll: true });
  }
})();
