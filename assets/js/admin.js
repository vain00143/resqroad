/* Administrator workspace: dashboard, report review, assignment, map,
   analytics, and user management. Everything renders from RoadWatchStore and
   re-renders after each change, including live changes from the database. */
(async function () {
  "use strict";

  const store = window.RoadWatchStore;
  const ui = window.RoadWatchUI;
  const shell = window.RoadWatchShell;
  const charts = window.RoadWatchCharts;
  const icon = ui.icon;
  const esc = ui.escapeHtml;
  const currentUser = await window.RoadWatchAuth.requireRole("admin", "login.html");
  if (!currentUser) {
    return;
  }

  const confirmedStatuses = ["verified", "assigned", "in_progress", "repair_submitted", "resolved"];
  const reviewStatuses = ["submitted", "under_review"];
  const severityRank = { High: 3, Medium: 2, Low: 1 };
  const severityColors = { High: "#d9443a", Medium: "#d9961e", Low: "#2f9461" };
  const brand = { rust: "#cf5c36", green: "#2f9461" };
  const layoutKey = "resqroad-report-layout";

  const viewDetails = {
    dashboard: { crumb: "Dashboard", title: "Admin dashboard", description: "Monitor incoming reports and the repair workflow.", icon: "dashboard" },
    analytics: { crumb: "Analytics & Reports", title: "Analytics and Reports", description: "Explore report trends, totals, and severity breakdowns.", icon: "chart-line" },
    reports: { crumb: "Review Reports", title: "Review Reports", description: "Review new reports, verify road damage, and record decisions.", icon: "clipboard-check" },
    assignments: { crumb: "Assignment", title: "Assignment", description: "Open verified reports to assign or change a maintenance team.", icon: "hard-hat" },
    maps: { crumb: "Map", title: "Map", description: "See verified road reports and their severity across Bulacan.", icon: "map" },
    users: { crumb: "User management", title: "User management", description: "Manage maintenance and citizen accounts.", icon: "users" },
  };

  const $ = function (selector) {
    return document.querySelector(selector);
  };
  const $$ = function (selector) {
    return Array.from(document.querySelectorAll(selector));
  };

  const els = {
    reportGrid: $("#report-rows"),
    reportTable: $("#report-table"),
    reportTableRows: $("#report-table-rows"),
    assignmentGrid: $("#assignment-rows"),
    map: $("#admin-map"),
    mapList: $("#map-list"),
    drawer: $("#report-drawer"),
    drawerScrim: $("#drawer-scrim"),
    drawerMeta: $("#drawer-meta"),
    drawerBody: $("#drawer-body"),
    drawerActions: $("#drawer-actions"),
    drawerClose: $("#drawer-close"),
    personnelForm: $("#new-personnel-form"),
  };

  let state = null;
  let currentView = "dashboard";
  let reportTab = "review";
  let usersTab = "crews";
  let mapSeverity = "all";
  let crewFilter = null;
  let layout = readPref(layoutKey) === "table" ? "table" : "grid";
  let openReportId = null;
  let drawerOpener = null;
  let restoreDrawerInert = null;
  let detailMap = null;
  let adminMap = null;
  const cardPhotoTimers = new Map();

  function readPref(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writePref(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Layout preference is optional.
    }
  }

  function runSafely(action) {
    try {
      action();
    } catch (error) {
      console.error("ResQRoad admin action failed.", error);
      ui.showMessage(error.message, "error");
    }
  }

  function loadState() {
    state = store.getState();
    return state;
  }

  function findReport(reportId) {
    return state.reports.find(function (item) {
      return item.id === reportId;
    });
  }

  function findPerson(personId) {
    return state.personnel.find(function (item) {
      return item.id === personId;
    });
  }

  function reporterName(report) {
    return store.reporterName(report, state);
  }

  function byNewest(first, second) {
    return Date.parse(second.reportedAt) - Date.parse(first.reportedAt);
  }

  function eventAt(report, status) {
    const event = (report.history || []).slice().reverse().find(function (item) {
      return item.status === status;
    });
    return event ? event.at : null;
  }

  function firstEventAt(report, status) {
    const event = (report.history || []).find(function (item) {
      return item.status === status;
    });
    return event ? event.at : null;
  }

  function matchesQuery(report, query, extra) {
    if (!query) {
      return true;
    }
    return [report.id, report.title, report.road, report.location, report.reporter, reporterName(report), extra || ""]
      .join(" ")
      .toLowerCase()
      .includes(query);
  }

  function municipality(location) {
    const parts = String(location || "").split(",").map(function (part) {
      return part.trim();
    });
    if (parts.length < 2) {
      return parts[0] || "Unknown";
    }
    return parts[parts.length - 1] === "Bulacan" ? parts[0] : parts[parts.length - 1];
  }

  function monthBuckets(count) {
    const buckets = [];
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    for (let offset = count - 1; offset >= 0; offset -= 1) {
      const date = new Date(start);
      date.setMonth(date.getMonth() - offset);
      const end = new Date(date);
      end.setMonth(end.getMonth() + 1);
      buckets.push({
        start: date,
        end: end,
        label: date.toLocaleDateString(undefined, { month: "short" }),
        longLabel: date.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      });
    }
    return buckets;
  }

  function countInBuckets(buckets, dates) {
    return buckets.map(function (bucket) {
      return dates.filter(function (value) {
        const time = Date.parse(value);
        return time >= bucket.start.getTime() && time < bucket.end.getTime();
      }).length;
    });
  }

  function average(values) {
    const valid = values.filter(function (value) {
      return Number.isFinite(value);
    });
    return valid.length
      ? valid.reduce(function (sum, value) {
          return sum + value;
        }, 0) / valid.length
      : null;
  }

  function formatDays(value) {
    if (value == null) {
      return "—";
    }
    if (value < 1) {
      return Math.max(1, Math.round(value * 24)) + "<small>hrs</small>";
    }
    return ui.formatNumber(value, 1) + "<small>days</small>";
  }

  /* ---------- Views ---------- */

  function showView(name, options) {
    const details = viewDetails[name];
    if (!details) {
      return;
    }
    currentView = name;
    $$("[data-admin-view-panel]").forEach(function (panel) {
      const active = panel.dataset.adminViewPanel === name;
      if (active && panel.hidden) {
        panel.hidden = false;
        // Restart the entrance animation.
        panel.style.animation = "none";
        panel.getBoundingClientRect();
        panel.style.animation = "";
      } else if (!active) {
        panel.hidden = true;
      }
    });
    $$("[data-admin-view]").forEach(function (button) {
      const isActive = button.dataset.adminView === name;
      button.classList.toggle("is-active", isActive);
      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
    $("#crumb-current").textContent = details.crumb;
    document.title = details.title + " | ResQRoad";
    if (!options || !options.keepHash) {
      history.replaceState(null, "", "#" + name);
    }
    if (!options || !options.keepScroll) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (name === "maps") {
      runSafely(renderMapView);
    }
    if (name === "analytics") {
      runSafely(renderAnalytics);
    }
    if (name === "dashboard") {
      runSafely(renderTrendChart);
    }
  }

  function openQueue(queue) {
    $("#search-reports").value = "";
    $("#severity-filter").value = "all";
    $("#status-filter").value = "all";
    setReportTab(queue === "repairs" ? "repairs" : queue === "all" ? "all" : "review");
    showView("reports");
  }

  /* ---------- Counts and dashboard ---------- */

  function counts() {
    const reports = state.reports;
    return {
      all: reports.length,
      review: reports.filter(function (report) {
        return reviewStatuses.includes(report.status);
      }).length,
      repairs: reports.filter(function (report) {
        return report.status === "repair_submitted";
      }).length,
      verified: reports.filter(function (report) {
        return report.status === "verified";
      }).length,
      assigned: reports.filter(function (report) {
        return report.status === "assigned";
      }).length,
      inProgress: reports.filter(function (report) {
        return report.status === "in_progress";
      }).length,
      resolved: reports.filter(function (report) {
        return report.status === "resolved";
      }).length,
      highOpen: reports.filter(function (report) {
        return report.severity === "High" && store.openStatuses.includes(report.status);
      }).length,
    };
  }

  function renderCounts() {
    const total = counts();
    $$('[data-count="review"]').forEach(function (element) {
      element.textContent = total.review;
    });
    $$('[data-count="repairs"]').forEach(function (element) {
      element.textContent = total.repairs;
    });
    $$('[data-count="all"]').forEach(function (element) {
      element.textContent = total.all;
    });
    const reportsBadge = $('[data-nav-count="reports"]');
    reportsBadge.textContent = total.review + total.repairs || "";
    reportsBadge.dataset.value = String(total.review + total.repairs);
    const assignBadge = $('[data-nav-count="assignments"]');
    assignBadge.textContent = total.verified || "";
    assignBadge.dataset.value = String(total.verified);
    $('[data-count="crews"]').textContent = state.personnel.length;
    $('[data-count="citizens"]').textContent = state.citizens.length;
    return total;
  }

  function kpiCard(options) {
    return (
      '<button class="card kpi" type="button" data-kpi="' +
      esc(options.key) +
      '"><span class="kpi-top"><span class="kpi-label">' +
      esc(options.label) +
      '</span><span class="kpi-icon" style="--tone:' +
      options.tone +
      '">' +
      icon(options.icon) +
      '</span></span><span class="kpi-value">' +
      options.value +
      '</span><span class="kpi-foot">' +
      options.foot +
      "</span>" +
      (options.spark || "") +
      "</button>"
    );
  }

  function trendText(current, previous, noun) {
    const difference = current - previous;
    if (difference > 0) {
      return '<span class="trend trend-up">' + icon("trending-up", "icon-sm") + "+" + difference + "</span> " + esc(noun);
    }
    if (difference < 0) {
      return '<span class="trend trend-flat">' + icon("trending-down", "icon-sm") + difference + "</span> " + esc(noun);
    }
    return '<span class="trend trend-flat">No change</span> ' + esc(noun);
  }

  function renderDashboard(total) {
    const now = new Date();
    const hour = now.getHours();
    $("[data-greeting]").textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    $("[data-first-name]").textContent = currentUser.name.split(" ")[0];
    $("[data-today]").textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

    const dayAgo = Date.now() - 86400000;
    const newToday = state.reports.filter(function (report) {
      return Date.parse(report.reportedAt) >= dayAgo;
    }).length;
    const summary = [];
    summary.push(ui.pluralize(newToday, "new report") + " in the last 24 hours");
    if (total.repairs) {
      summary.push(ui.pluralize(total.repairs, "repair") + " waiting for verification");
    }
    if (total.highOpen) {
      summary.push(total.highOpen + " high-severity " + (total.highOpen === 1 ? "issue" : "issues") + " still open");
    }
    $("#dashboard-summary").textContent = summary.join(" · ") + ".";

    const buckets = monthBuckets(8);
    const submittedSeries = countInBuckets(
      buckets,
      state.reports.map(function (report) {
        return report.reportedAt;
      }),
    );
    const resolvedSeries = countInBuckets(
      buckets,
      state.reports
        .map(function (report) {
          return report.status === "resolved" ? eventAt(report, "resolved") : null;
        })
        .filter(Boolean),
    );
    const thisMonth = submittedSeries[submittedSeries.length - 1];
    const lastMonth = submittedSeries[submittedSeries.length - 2];
    const validReports = state.reports.filter(function (report) {
      return report.status !== "rejected" && report.status !== "duplicate";
    }).length;
    const resolutionRate = validReports ? Math.round((total.resolved / validReports) * 100) : 0;
    const highWaiting = state.reports.filter(function (report) {
      return reviewStatuses.includes(report.status) && report.severity === "High";
    }).length;

    $("#admin-stats").innerHTML = [
      kpiCard({
        key: "all",
        label: "Total reports",
        value: total.all,
        icon: "clipboard-list",
        tone: "var(--accent)",
        foot: trendText(thisMonth, lastMonth, "vs last month"),
        spark: charts.sparkline(submittedSeries, brand.rust),
      }),
      kpiCard({
        key: "review",
        label: "Waiting for review",
        value: total.review,
        icon: "inbox",
        tone: "var(--warning)",
        foot: highWaiting
          ? '<span class="trend trend-down">' + icon("alert-triangle", "icon-sm") + highWaiting + " high severity</span>"
          : "No high-severity reports waiting",
      }),
      kpiCard({
        key: "in_progress",
        label: "Repair in Progress",
        value: total.inProgress,
        icon: "construction",
        tone: "var(--info)",
        foot: ui.pluralize(total.assigned, "job") + " assigned, not started",
      }),
      kpiCard({
        key: "resolved",
        label: "Resolved",
        value: total.resolved,
        icon: "check-circle",
        tone: "var(--success)",
        foot: '<span class="trend trend-up">' + resolutionRate + "%</span> resolution rate",
        spark: charts.sparkline(resolvedSeries, brand.green),
      }),
    ].join("");

    $("#queue-summary").innerHTML = [
      { queue: "review", label: "Reports to review", hint: "Submitted or under review", count: total.review, icon: "inbox", tone: "var(--warning)" },
      { queue: "repairs", label: "Repairs to verify", hint: "Crews finished the work", count: total.repairs, icon: "wrench", tone: "var(--st-repair_submitted)" },
      { queue: "assign", label: "Ready to assign", hint: "Verified, no crew yet", count: total.verified, icon: "hard-hat", tone: "var(--accent)" },
      { queue: "high", label: "High-severity open", hint: "Prioritize these first", count: total.highOpen, icon: "alert-triangle", tone: "var(--sev-high)" },
    ]
      .map(function (item) {
        return (
          '<li><button class="attention-item" type="button" data-attention="' +
          item.queue +
          '" style="--tone:' +
          item.tone +
          '"><span class="attention-icon">' +
          icon(item.icon) +
          '</span><span class="attention-copy"><strong>' +
          esc(item.label) +
          "</strong><span>" +
          esc(item.hint) +
          '</span></span><span class="attention-count">' +
          item.count +
          "</span></button></li>"
        );
      })
      .join("");

    const recent = state.reports.slice().sort(byNewest).slice(0, 6);
    $("#recent-report-rows").innerHTML = recent
      .map(function (report) {
        return (
          '<tr class="is-clickable" data-report-id="' +
          esc(report.id) +
          '"><td><button class="link-button cell-title" type="button" data-action="open" data-report-id="' +
          esc(report.id) +
          '" style="color: var(--heading)">' +
          esc(report.title) +
          '</button><span class="cell-sub">' +
          esc(report.id) +
          " · " +
          esc(report.road) +
          "</span></td><td>" +
          ui.severityBadge(report.severity) +
          "</td><td>" +
          ui.statusPill(report.status) +
          '</td><td class="muted" style="white-space: nowrap">' +
          esc(ui.relativeTime(report.reportedAt)) +
          "</td></tr>"
        );
      })
      .join("");

    renderActivityFeed();
    renderTrendChart();
  }

  function recentEvents(limit, filter) {
    const events = [];
    state.reports.forEach(function (report) {
      (report.history || []).forEach(function (entry) {
        if (!filter || filter(entry, report)) {
          events.push({ report: report, entry: entry });
        }
      });
    });
    events.sort(function (first, second) {
      return Date.parse(second.entry.at) - Date.parse(first.entry.at);
    });
    return events.slice(0, limit);
  }

  function renderActivityFeed() {
    const events = recentEvents(10);
    $("#activity-feed").innerHTML = events.length
      ? '<ol class="timeline">' +
        events
          .map(function (item) {
            const isNote = item.entry.status === "note";
            return (
              '<li class="timeline-item"><span class="timeline-dot status-' +
              esc(item.entry.status) +
              (isNote ? " is-note" : "") +
              '" aria-hidden="true"></span><span class="timeline-title"><button class="link-button" type="button" data-action="open" data-report-id="' +
              esc(item.report.id) +
              '">' +
              esc(item.report.id) +
              "</button> · " +
              esc(isNote ? "Note: " + item.entry.note : item.entry.description) +
              '</span><span class="timeline-meta">' +
              esc((item.entry.actor ? item.entry.actor + " · " : "") + ui.relativeTime(item.entry.at)) +
              "</span></li>"
            );
          })
          .join("") +
        "</ol>"
      : '<p class="muted text-sm">No activity yet.</p>';
  }

  function renderTrendChart() {
    if (currentView !== "dashboard" || !state) {
      return;
    }
    const buckets = monthBuckets(8);
    const series = [
      {
        name: "Reports submitted",
        color: brand.rust,
        fill: true,
        values: countInBuckets(
          buckets,
          state.reports.map(function (report) {
            return report.reportedAt;
          }),
        ),
      },
      {
        name: "Repairs resolved",
        color: brand.green,
        fill: true,
        values: countInBuckets(
          buckets,
          state.reports
            .map(function (report) {
              return report.status === "resolved" ? eventAt(report, "resolved") : null;
            })
            .filter(Boolean),
        ),
      },
    ];
    $("#trend-legend").innerHTML = charts.legendHtml(series);
    charts.area($("#trend-chart"), {
      labels: buckets.map(function (bucket) {
        return bucket.label;
      }),
      tooltipLabels: buckets.map(function (bucket) {
        return bucket.longLabel;
      }),
      series: series,
      ariaLabel: "Reports submitted and resolved per month for the last 8 months",
    });
  }

  /* ---------- Report cards ---------- */

  function renderReportCard(report, index, mode) {
    const photos = ui.reportPhotos(report);
    const slides = photos
      .map(function (photo) {
        return ui.photoImg(photo, 'class="rc-photo" style="width:' + 100 / photos.length + "%;flex-basis:" + 100 / photos.length + '%"');
      })
      .join("");
    const dots =
      photos.length > 1
        ? '<span class="rc-dots" aria-hidden="true">' +
          photos
            .map(function (photo, photoIndex) {
              return '<span class="rc-dot' + (photoIndex === 0 ? " is-active" : "") + '"></span>';
            })
            .join("") +
          "</span>"
        : "";
    let footer;
    if (mode === "assignment") {
      const person = findPerson(report.assignedTo);
      footer = report.assignedTo
        ? '<span class="rc-crew">' +
          icon("hard-hat") +
          "<span>" +
          esc(person ? person.team + " · " + person.name : report.assignedName || "Former personnel") +
          "</span></span>"
        : '<span class="rc-crew is-unassigned">' + icon("alert-circle") + "<span>Awaiting assignment</span></span>";
    } else {
      const name = reporterName(report);
      footer =
        '<span class="person">' +
        ui.avatar(name, "sm") +
        '<span class="person-copy"><strong>' +
        esc(name) +
        "</strong></span></span>";
    }
    return (
      '<button class="report-card" type="button" data-action="open" data-report-id="' +
      esc(report.id) +
      '" style="--i:' +
      Math.min(index, 12) +
      '" aria-label="' +
      esc(report.id + ": " + report.title + ", " + report.severity + " severity, " + ui.statusLabel(report.status)) +
      '"><span class="rc-media"><span class="rc-track" data-photo-index="0" data-photo-count="' +
      photos.length +
      '" style="width:' +
      photos.length * 100 +
      '%">' +
      slides +
      "</span>" +
      dots +
      ui.severityBadge(report.severity, { solid: true, className: "rc-sev" }) +
      '<span class="rc-age">' +
      icon("clock") +
      esc(ui.relativeTime(report.reportedAt)) +
      '</span></span><span class="rc-body"><span class="rc-top"><span class="id-tag">' +
      esc(report.id) +
      "</span>" +
      ui.statusPill(report.status) +
      '</span><strong class="rc-title">' +
      esc(report.title) +
      '</strong><span class="rc-loc">' +
      icon("map-pin") +
      "<span>" +
      esc(report.road + " · " + report.location) +
      '</span></span></span><span class="rc-foot">' +
      footer +
      '<span class="rc-date">' +
      icon("calendar") +
      esc(ui.formatShortDay(report.reportedAt)) +
      "</span></span></button>"
    );
  }

  function setSlide(card, index) {
    const track = card.querySelector(".rc-track");
    const count = Number(track.dataset.photoCount || 1);
    track.dataset.photoIndex = String(index);
    track.style.transform = "translateX(-" + (index * 100) / count + "%)";
    card.querySelectorAll(".rc-dot").forEach(function (dot, dotIndex) {
      dot.classList.toggle("is-active", dotIndex === index);
    });
  }

  function startCardSlideshow(card) {
    if (!card || cardPhotoTimers.has(card)) {
      return;
    }
    const track = card.querySelector(".rc-track");
    const count = Number(track && track.dataset.photoCount);
    if (!track || count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let index = Number(track.dataset.photoIndex || 0);
    const timer = window.setInterval(function () {
      index = (index + 1) % count;
      setSlide(card, index);
    }, 1800);
    cardPhotoTimers.set(card, timer);
  }

  function pauseCardSlideshow(card) {
    const timer = cardPhotoTimers.get(card);
    if (timer) {
      window.clearInterval(timer);
      cardPhotoTimers.delete(card);
    }
  }

  function stopCardSlideshow(card) {
    if (!card) {
      return;
    }
    pauseCardSlideshow(card);
    if (card.querySelector(".rc-track")) {
      setSlide(card, 0);
    }
  }

  function clearSlideshows() {
    cardPhotoTimers.forEach(function (timer) {
      window.clearInterval(timer);
    });
    cardPhotoTimers.clear();
  }

  function bindCardInteractions(container) {
    container.addEventListener("pointerover", function (event) {
      if (event.pointerType !== "mouse") {
        return;
      }
      const card = event.target.closest(".report-card");
      if (card && !card.contains(event.relatedTarget)) {
        startCardSlideshow(card);
      }
    });
    container.addEventListener("pointerout", function (event) {
      if (event.pointerType !== "mouse") {
        return;
      }
      const card = event.target.closest(".report-card");
      if (card && !card.contains(event.relatedTarget)) {
        stopCardSlideshow(card);
      }
    });
    // Hovering a card photo shows it larger; the slideshow waits while it does.
    ui.bindPhotoPreview(container, {
      selector: ".rc-media",
      getImage: function (media) {
        const track = media.querySelector(".rc-track");
        return track && track.children[Number(track.dataset.photoIndex || 0)];
      },
      onShow: function (media) {
        pauseCardSlideshow(media.closest(".report-card"));
      },
      onHide: function (media, event) {
        const card = media.closest(".report-card");
        if (card && card.isConnected && (!event || card.contains(event.relatedTarget))) {
          startCardSlideshow(card);
        }
      },
    });
    container.addEventListener("click", function (event) {
      const card = event.target.closest('[data-action="open"]');
      if (card) {
        stopCardSlideshow(card.closest(".report-card"));
        runSafely(function () {
          openReport(card.dataset.reportId, card);
        });
      }
    });
  }

  /* ---------- Review Reports ---------- */

  function setReportTab(tab) {
    reportTab = tab;
    $$("[data-report-tab]").forEach(function (button) {
      button.setAttribute("aria-selected", String(button.dataset.reportTab === tab));
    });
    $("#status-filter-slot").hidden = tab !== "all";
    renderReports();
  }

  function filteredReports() {
    const query = $("#search-reports").value.trim().toLowerCase();
    const severity = $("#severity-filter").value;
    const status = $("#status-filter").value;
    const sort = $("#sort-reports").value;
    const reports = state.reports.filter(function (report) {
      if (reportTab === "review" && !reviewStatuses.includes(report.status)) {
        return false;
      }
      if (reportTab === "repairs" && report.status !== "repair_submitted") {
        return false;
      }
      if (reportTab === "all" && status !== "all" && report.status !== status) {
        return false;
      }
      return (severity === "all" || report.severity === severity) && matchesQuery(report, query);
    });
    reports.sort(function (first, second) {
      if (sort === "oldest") {
        return -byNewest(first, second);
      }
      if (sort === "severity") {
        return severityRank[second.severity] - severityRank[first.severity] || byNewest(first, second);
      }
      return byNewest(first, second);
    });
    return reports;
  }

  function emptyState(iconName, title, text) {
    return (
      '<span class="empty-icon">' +
      icon(iconName) +
      "</span><h3>" +
      esc(title) +
      "</h3><p>" +
      esc(text) +
      "</p>"
    );
  }

  function renderReports() {
    if (!state) {
      return;
    }
    clearSlideshows();
    const reports = filteredReports();
    const filtersActive =
      $("#search-reports").value.trim() ||
      $("#severity-filter").value !== "all" ||
      (reportTab === "all" && $("#status-filter").value !== "all");

    $$("[data-layout]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.layout === layout));
    });
    els.reportGrid.hidden = layout !== "grid" || reports.length === 0;
    els.reportTable.hidden = layout !== "table" || reports.length === 0;

    if (layout === "grid") {
      els.reportGrid.innerHTML = reports
        .map(function (report, index) {
          return renderReportCard(report, index, "review");
        })
        .join("");
    } else {
      els.reportTableRows.innerHTML = reports
        .map(function (report) {
          const name = reporterName(report);
          return (
            '<tr class="is-clickable" data-report-id="' +
            esc(report.id) +
            '"><td><button class="link-button cell-title" type="button" data-action="open" data-report-id="' +
            esc(report.id) +
            '" style="color: var(--heading)">' +
            esc(report.title) +
            '</button><span class="cell-sub">' +
            esc(report.id + " · " + report.road + " · " + report.location) +
            '</span></td><td><span class="person">' +
            ui.avatar(name, "sm") +
            '<span class="person-copy"><strong>' +
            esc(name) +
            "</strong></span></span></td><td>" +
            ui.severityBadge(report.severity) +
            "</td><td>" +
            ui.statusPill(report.status) +
            '</td><td class="muted" style="white-space: nowrap">' +
            esc(ui.formatDay(report.reportedAt)) +
            "</td></tr>"
          );
        })
        .join("");
    }

    const empty = $("#empty-reports");
    empty.hidden = reports.length !== 0;
    if (reports.length === 0) {
      if (filtersActive) {
        empty.innerHTML = emptyState("search", "No reports match your filters", "Try a different search or clear the severity filter.");
      } else if (reportTab === "review") {
        empty.innerHTML = emptyState("check-circle", "All caught up", "There are no new reports waiting for review.");
      } else if (reportTab === "repairs") {
        empty.innerHTML = emptyState("wrench", "No repairs to verify", "Completed repairs from maintenance crews will appear here.");
      } else {
        empty.innerHTML = emptyState("inbox", "No reports yet", "Citizen reports will appear here.");
      }
    }
    const tabNames = { review: "waiting for review", repairs: "waiting for repair verification", all: "in total" };
    $("#reports-meta").textContent =
      reports.length === 0 ? "" : "Showing " + ui.pluralize(reports.length, "report") + " " + tabNames[reportTab] + ".";
  }

  /* ---------- Assignment ---------- */

  function crewStats(person) {
    const assigned = state.reports.filter(function (report) {
      return report.assignedTo === person.id;
    });
    return {
      total: assigned.length,
      open: assigned.filter(function (report) {
        return store.crewOpenStatuses.includes(report.status);
      }).length,
      resolved: assigned.filter(function (report) {
        return report.status === "resolved";
      }).length,
      repairDays: average(
        assigned.map(function (report) {
          const started = firstEventAt(report, "in_progress");
          const submitted = eventAt(report, "repair_submitted");
          return started && submitted ? ui.daysBetween(started, submitted) : NaN;
        }),
      ),
    };
  }

  function renderAssignments() {
    const query = $("#manage-search").value.trim().toLowerCase();
    const status = $("#manage-status-filter").value;
    const severity = $("#manage-severity-filter").value;
    const reports = state.reports.filter(function (report) {
      if (!["verified", "assigned"].includes(report.status)) {
        return false;
      }
      if (crewFilter && report.assignedTo !== crewFilter) {
        return false;
      }
      const person = findPerson(report.assignedTo);
      const crewText = person ? person.name + " " + person.team : report.assignedName || "";
      return (
        (status === "all" || report.status === status) &&
        (severity === "all" || report.severity === severity) &&
        matchesQuery(report, query, crewText)
      );
    });
    // Newly verified reports first, as before.
    reports.sort(function (first, second) {
      const a = Date.parse(firstEventAt(first, "verified") || 0) || 0;
      const b = Date.parse(firstEventAt(second, "verified") || 0) || 0;
      return b - a;
    });

    els.assignmentGrid.innerHTML = reports
      .map(function (report, index) {
        return renderReportCard(report, index, "assignment");
      })
      .join("");
    const empty = $("#empty-assignments");
    empty.hidden = reports.length !== 0;
    if (reports.length === 0) {
      empty.innerHTML =
        query || status !== "all" || severity !== "all" || crewFilter
          ? emptyState("search", "No reports match your filters", "Try a different search, or clear the crew filter.")
          : emptyState("check-circle", "Nothing to assign", "Verified reports appear here, ready for a maintenance crew.");
    }
    const crew = crewFilter ? findPerson(crewFilter) : null;
    $("#assignments-meta").innerHTML = crew
      ? "Showing " +
        esc(crew.team) +
        ' only. <button class="link-button" type="button" data-clear-crew>Show all crews</button>'
      : reports.length
        ? "Showing " + ui.pluralize(reports.length, "report") + "."
        : "";

    const total = counts();
    $("#assign-summary").innerHTML = [
      { label: "Awaiting assignment", value: total.verified, icon: "alert-circle", tone: "var(--warning)" },
      { label: "Assigned, not started", value: total.assigned, icon: "hard-hat", tone: "var(--accent)" },
      { label: "Repairs in progress", value: total.inProgress, icon: "construction", tone: "var(--info)" },
    ]
      .map(function (item) {
        return (
          '<div class="card mini-stat"><span class="kpi-icon" style="--tone:' +
          item.tone +
          '">' +
          icon(item.icon) +
          "</span><div><strong>" +
          item.value +
          "</strong><span>" +
          esc(item.label) +
          "</span></div></div>"
        );
      })
      .join("");

    const maxOpen = Math.max(
      4,
      Math.max.apply(
        null,
        state.personnel.map(function (person) {
          return crewStats(person).open;
        }).concat([0]),
      ),
    );
    $("#crew-workload").innerHTML = state.personnel.length
      ? state.personnel
          .map(function (person) {
            const stats = crewStats(person);
            const load = stats.open / maxOpen;
            return (
              '<li><button class="crew-row' +
              (crewFilter === person.id ? " is-selected" : "") +
              '" type="button" data-crew="' +
              esc(person.id) +
              '" aria-pressed="' +
              String(crewFilter === person.id) +
              '"><span class="person">' +
              ui.avatar(person.name, "sm") +
              '<span class="person-copy"><strong>' +
              esc(person.team) +
              "</strong><span>" +
              esc(person.name) +
              '</span></span></span><span class="crew-meta"><strong>' +
              stats.open +
              "</strong> open</span>" +
              '<span class="crew-load' +
              (stats.open >= 3 ? " is-busy" : stats.open === 0 ? " is-light" : "") +
              '"><span style="width:' +
              Math.max(4, load * 100) +
              '%"></span></span></button></li>'
            );
          })
          .join("")
      : '<li class="muted text-sm">No maintenance crews yet. Add one in User management.</li>';
  }

  /* ---------- Map ---------- */

  function mapReports() {
    const scope = $("#map-scope").value;
    return state.reports
      .filter(function (report) {
        if (scope === "confirmed" && !confirmedStatuses.includes(report.status)) {
          return false;
        }
        if (scope === "open" && !store.openStatuses.includes(report.status)) {
          return false;
        }
        return mapSeverity === "all" || report.severity === mapSeverity;
      })
      .sort(function (first, second) {
        return severityRank[second.severity] - severityRank[first.severity] || byNewest(first, second);
      });
  }

  function renderMapView() {
    if (currentView !== "maps" || !state) {
      return;
    }
    const reports = mapReports();
    adminMap = ui.renderMap(els.map, reports, {
      emptyMessage: "No verified reports to show on the map.",
      onAction: function (action, reportId, button) {
        openReport(reportId, button);
      },
      onSelect: function (reportId) {
        highlightMapItem(reportId);
      },
      pulse: function (report) {
        return report.severity === "High" && store.openStatuses.includes(report.status);
      },
    });
    $("#map-legend").innerHTML = ui.mapLegend() + '<p class="field-hint" style="margin-top: 0.35rem">Select a pin to see the report, then open its details.</p>';
    $("#map-count").textContent = ui.pluralize(reports.length, "report") + " shown";
    els.mapList.innerHTML = reports.length
      ? reports
          .map(function (report) {
            return (
              '<li><button class="map-list-item" type="button" data-map-focus="' +
              esc(report.id) +
              '"><i class="legend-dot is-' +
              esc(report.severity.toLowerCase()) +
              '"></i><strong>' +
              esc(report.title) +
              "</strong><small><span>" +
              esc(report.id + " · " + report.road) +
              "</span>" +
              ui.statusPill(report.status) +
              "</small></button></li>"
            );
          })
          .join("")
      : '<li class="empty"><p>No reports match these filters.</p></li>';
  }

  function highlightMapItem(reportId) {
    els.mapList.querySelectorAll(".map-list-item").forEach(function (item) {
      const active = item.dataset.mapFocus === reportId;
      item.classList.toggle("is-active", active);
      if (active) {
        item.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }

  /* ---------- Analytics ---------- */

  function renderAnalytics() {
    if (currentView !== "analytics" || !state) {
      return;
    }
    const range = Number($("#analytics-range").value) || 8;
    const buckets = monthBuckets(range);
    const since = buckets[0].start.getTime();
    const reports = state.reports.filter(function (report) {
      return Date.parse(report.reportedAt) >= since;
    });
    const resolved = reports.filter(function (report) {
      return report.status === "resolved";
    });
    const valid = reports.filter(function (report) {
      return report.status !== "rejected" && report.status !== "duplicate";
    });
    const verifyDays = average(
      reports.map(function (report) {
        const verified = firstEventAt(report, "verified");
        return verified ? ui.daysBetween(report.reportedAt, verified) : NaN;
      }),
    );
    const resolveDays = average(
      resolved.map(function (report) {
        return ui.daysBetween(report.reportedAt, eventAt(report, "resolved"));
      }),
    );
    const highOpen = reports.filter(function (report) {
      return report.severity === "High" && store.openStatuses.includes(report.status);
    }).length;
    const rate = valid.length ? Math.round((resolved.length / valid.length) * 100) : 0;

    $("#analytics-kpis").innerHTML = [
      { label: "Resolution rate", value: rate + "<small>%</small>", icon: "target", tone: "var(--success)", foot: resolved.length + " of " + valid.length + " valid reports resolved" },
      { label: "Avg. time to verify", value: formatDays(verifyDays), icon: "shield-check", tone: "var(--accent)", foot: "From report to admin verification" },
      { label: "Avg. time to resolve", value: formatDays(resolveDays), icon: "timer", tone: "var(--info)", foot: "From report to verified repair" },
      { label: "Open high severity", value: String(highOpen), icon: "alert-triangle", tone: "var(--sev-high)", foot: highOpen ? "Prioritize these repairs" : "Nothing urgent right now" },
    ]
      .map(function (item) {
        return (
          '<div class="card kpi"><span class="kpi-top"><span class="kpi-label">' +
          esc(item.label) +
          '</span><span class="kpi-icon" style="--tone:' +
          item.tone +
          '">' +
          icon(item.icon) +
          '</span></span><span class="kpi-value">' +
          item.value +
          '</span><span class="kpi-foot">' +
          esc(item.foot) +
          "</span></div>"
        );
      })
      .join("");

    const series = [
      {
        name: "Submitted",
        color: brand.rust,
        values: countInBuckets(
          buckets,
          reports.map(function (report) {
            return report.reportedAt;
          }),
        ),
      },
      {
        name: "Resolved",
        color: brand.green,
        values: countInBuckets(
          buckets,
          state.reports
            .map(function (report) {
              return report.status === "resolved" ? eventAt(report, "resolved") : null;
            })
            .filter(Boolean),
        ),
      },
    ];
    $("#monthly-subtitle").textContent = "Report submissions and resolved repairs over the last " + range + " months.";
    $("#monthly-legend").innerHTML = charts.legendHtml(series);
    charts.columns($("#monthly-report-chart"), {
      labels: buckets.map(function (bucket) {
        return bucket.label;
      }),
      tooltipLabels: buckets.map(function (bucket) {
        return bucket.longLabel;
      }),
      series: series,
      ariaLabel: "Monthly report submissions and resolutions for the last " + range + " months",
    });

    charts.donut(
      $("#severity-chart"),
      ["High", "Medium", "Low"].map(function (severity) {
        return {
          label: severity,
          color: severityColors[severity],
          value: reports.filter(function (report) {
            return report.severity === severity;
          }).length,
        };
      }),
      { centerLabel: "Reports", ariaLabel: "Report severity distribution" },
    );

    charts.barList(
      $("#status-chart"),
      Object.keys(store.statuses)
        .map(function (status) {
          return {
            label: store.statuses[status],
            value: reports.filter(function (report) {
              return report.status === status;
            }).length,
            tone: "var(--st-" + status + ")",
          };
        })
        .filter(function (item) {
          return item.value > 0;
        }),
      { empty: "No reports in this period." },
    );

    const byPlace = {};
    reports.forEach(function (report) {
      const place = municipality(report.location);
      byPlace[place] = (byPlace[place] || 0) + 1;
    });
    charts.barList(
      $("#location-chart"),
      Object.keys(byPlace)
        .map(function (place) {
          return { label: place, value: byPlace[place] };
        })
        .sort(function (first, second) {
          return second.value - first.value;
        })
        .slice(0, 6),
      { empty: "No reports in this period." },
    );

    $("#crew-performance-rows").innerHTML = state.personnel.length
      ? state.personnel
          .map(function (person) {
            const stats = crewStats(person);
            return (
              '<tr><td><span class="person">' +
              ui.avatar(person.name, "sm") +
              '<span class="person-copy"><strong>' +
              esc(person.team) +
              "</strong><span>" +
              esc(person.name) +
              '</span></span></span></td><td class="num">' +
              stats.total +
              '</td><td class="num">' +
              stats.open +
              '</td><td class="num">' +
              stats.resolved +
              '</td><td class="num">' +
              (stats.repairDays == null ? "—" : ui.formatNumber(stats.repairDays, 1) + " days") +
              "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="5" class="muted">No maintenance crews yet.</td></tr>';
  }

  function exportCsv() {
    const rows = [
      ["Report ID", "Title", "Road", "Location", "Latitude", "Longitude", "Severity", "Status", "Reporter", "Reported at", "Assigned crew", "Resolved at"],
    ];
    state.reports
      .slice()
      .sort(byNewest)
      .forEach(function (report) {
        const person = findPerson(report.assignedTo);
        rows.push([
          report.id,
          report.title,
          report.road,
          report.location,
          report.coordinates.lat,
          report.coordinates.lng,
          report.severity,
          ui.statusLabel(report.status),
          reporterName(report),
          new Date(report.reportedAt).toISOString(),
          person ? person.team + " (" + person.name + ")" : report.assignedName || "",
          report.status === "resolved" ? eventAt(report, "resolved") || "" : "",
        ]);
      });
    ui.downloadCsv("resqroad-reports-" + new Date().toISOString().slice(0, 10) + ".csv", rows);
    ui.showMessage("Exported " + ui.pluralize(state.reports.length, "report") + " to CSV.", "success");
  }

  /* ---------- Users ---------- */

  function setUsersTab(tab) {
    usersTab = tab;
    $$("[data-users-tab]").forEach(function (button) {
      button.setAttribute("aria-selected", String(button.dataset.usersTab === tab));
    });
    $$("[data-users-panel]").forEach(function (panel) {
      panel.hidden = panel.dataset.usersPanel !== tab;
    });
  }

  function renderUsers() {
    $("#personnel-rows").innerHTML = state.personnel
      .map(function (person) {
        const stats = crewStats(person);
        return (
          "<tr><td>" +
          '<span class="person">' +
          ui.avatar(person.name) +
          '<span class="person-copy"><strong>' +
          esc(person.name) +
          "</strong><span>" +
          esc(person.email || "No email") +
          "</span></span></span></td><td>" +
          esc(person.team) +
          '</td><td class="num"><span class="count-badge' +
          (stats.open ? " is-hot" : "") +
          '">' +
          stats.open +
          '</span></td><td class="num">' +
          stats.resolved +
          '</td><td class="cell-actions"><button class="btn btn-danger-outline btn-sm" type="button" data-action="delete-person" data-user-id="' +
          esc(person.id) +
          '">' +
          icon("trash", "icon-sm") +
          "Delete</button></td></tr>"
        );
      })
      .join("");
    $("#empty-personnel").hidden = state.personnel.length !== 0;

    const teams = Array.from(
      new Set(
        state.personnel.map(function (person) {
          return person.team;
        }),
      ),
    );
    $("#crew-suggestions").innerHTML = teams
      .map(function (team) {
        return '<option value="' + esc(team) + '"></option>';
      })
      .join("");

    const query = $("#citizen-search").value.trim().toLowerCase();
    const citizens = state.citizens.filter(function (citizen) {
      return !query || (citizen.name + " " + citizen.email).toLowerCase().includes(query);
    });
    $("#citizen-rows").innerHTML = citizens
      .map(function (citizen) {
        const active = citizen.active !== false;
        const reportCount = store.reportsByCitizen(citizen, state).length;
        return (
          '<tr><td><span class="person">' +
          ui.avatar(citizen.name) +
          '<span class="person-copy"><strong>' +
          esc(citizen.name) +
          "</strong><span>" +
          esc(citizen.email) +
          '</span></span></span></td><td class="num">' +
          reportCount +
          '</td><td class="muted" style="white-space: nowrap">' +
          esc(citizen.createdAt ? ui.formatDay(citizen.createdAt) : "—") +
          '</td><td><span class="pill account-status' +
          (active ? "" : " is-inactive") +
          '"><span class="pill-dot"></span>' +
          (active ? "Active" : "Inactive") +
          '</span></td><td class="cell-actions"><button class="btn ' +
          (active ? "btn-danger-outline" : "btn-secondary") +
          ' btn-sm" type="button" data-action="toggle-citizen" data-user-id="' +
          esc(citizen.id) +
          '" data-active="' +
          String(active) +
          '">' +
          icon(active ? "user-x" : "user-check", "icon-sm") +
          (active ? "Deactivate" : "Reactivate") +
          "</button></td></tr>"
        );
      })
      .join("");
    $("#empty-citizens").hidden = citizens.length !== 0;
  }

  /* ---------- Report drawer ---------- */

  function reviewActions(report) {
    const decisions = [];
    if (report.status === "submitted") {
      decisions.push({ status: "under_review", label: "Mark under review", style: "btn-secondary", icon: "eye" });
    }
    if (report.status === "submitted" || report.status === "under_review") {
      decisions.push({ status: "duplicate", label: "Mark duplicate", style: "btn-secondary", icon: "copy" });
      decisions.push({ status: "rejected", label: "Reject report", style: "btn-danger-outline", icon: "ban" });
      decisions.push({ status: "verified", label: "Verify report", style: "btn-primary", icon: "shield-check" });
    }
    if (report.status === "repair_submitted") {
      decisions.push({ status: "in_progress", label: "Request more work", style: "btn-secondary", icon: "reset" });
      decisions.push({ status: "resolved", label: "Verify repair and resolve", style: "btn-primary", icon: "check-circle" });
    }
    return decisions;
  }

  function photoGallery(photos, label) {
    return (
      '<div class="gallery" aria-label="' +
      esc(label) +
      '">' +
      photos
        .map(function (photo, index) {
          return (
            '<button class="gallery-item" type="button" data-gallery-index="' +
            index +
            '" aria-label="View photo ' +
            (index + 1) +
            " of " +
            photos.length +
            " full size" +
            (photo.alt ? ": " + esc(photo.alt) : "") +
            '">' +
            ui.photoImg(photo) +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function repairPhotos(list, label) {
    const withData = ui.photosWithData(list);
    if (withData.length) {
      return '<div data-gallery-group="' + esc(label) + '">' + photoGallery(withData, label + " photos") + "</div>";
    }
    return ui.fileChips(list);
  }

  function renderDrawer(reportId) {
    const report = findReport(reportId);
    if (!report) {
      throw new Error("This report is no longer available.");
    }
    // Live updates re-render the drawer; keep what the admin was typing.
    const sameReport = els.drawerBody.dataset.reportId === reportId;
    const noteField = els.drawerBody.querySelector('textarea[name="note"]');
    const assignField = els.drawerBody.querySelector("[data-assign-select]");
    const draft = sameReport
      ? {
          note: noteField ? noteField.value : "",
          crew: assignField ? assignField.value : "",
          scroll: els.drawerBody.scrollTop,
          focusNote: document.activeElement === noteField,
        }
      : null;
    if (detailMap) {
      detailMap.destroy();
      detailMap = null;
    }
    const photos = ui.reportPhotos(report);
    const name = reporterName(report);
    const person = findPerson(report.assignedTo);
    const assignmentDate = eventAt(report, "assigned");
    const hasAssignment = Boolean(report.assignedTo || report.assignedName);
    const canAssign = ["verified", "assigned"].includes(report.status);

    els.drawerMeta.innerHTML =
      '<span class="id-tag">' +
      esc(report.id) +
      "</span>" +
      ui.statusPill(report.status) +
      ui.severityBadge(report.severity);

    const assignmentSummary = hasAssignment
      ? '<dl class="facts"><div><dt>Assigned personnel</dt><dd>' +
        esc(person ? person.name : report.assignedName || "Former personnel") +
        "</dd></div><div><dt>Crew / team</dt><dd>" +
        esc(person ? person.team : "Team unavailable") +
        "</dd></div><div><dt>Assigned date</dt><dd>" +
        esc(assignmentDate ? ui.formatDate(assignmentDate) : "Date unavailable") +
        "</dd></div><div><dt>Assignment status</dt><dd>" +
        esc(ui.statusLabel(report.status)) +
        "</dd></div></dl>"
      : '<p class="muted text-sm" style="margin: 0">' +
        (canAssign ? "Not yet assigned. Choose a crew below." : "Not yet assigned. Verify the report before assigning a crew.") +
        "</p>";
    const assignmentControl = canAssign
      ? '<div class="assign-control"><label class="field"><span class="field-label">Maintenance team</span><select aria-label="Choose maintenance team for ' +
        esc(report.id) +
        '" data-assign-select="' +
        esc(report.id) +
        '"><option value="">Choose a team</option>' +
        state.personnel
          .map(function (crew) {
            const open = crewStats(crew).open;
            return (
              '<option value="' +
              esc(crew.id) +
              '"' +
              (crew.id === report.assignedTo ? " selected" : "") +
              ">" +
              esc(crew.team + " - " + crew.name + " (" + open + " open)") +
              "</option>"
            );
          })
          .join("") +
        '</select></label><button class="btn btn-primary" type="button" data-action="assign" data-report-id="' +
        esc(report.id) +
        '">' +
        icon("hard-hat") +
        (report.status === "assigned" ? "Reassign team" : "Assign team") +
        "</button></div>"
      : "";

    const repair = report.repair
      ? '<section class="detail-block"><div class="detail-block-head"><h3>' +
        icon("wrench") +
        'Repair submission</h3><span class="muted text-sm">' +
        esc(report.repair.submittedAt ? "Submitted " + ui.formatDate(report.repair.submittedAt) : "") +
        '</span></div><div class="callout callout-tone"><p class="detail-description">' +
        esc(report.repair.notes || "No repair notes.") +
        '</p><div class="before-after"><div><h4>Before</h4>' +
        repairPhotos(report.repair.beforePhotos, "Before") +
        "</div><div><h4>After</h4>" +
        repairPhotos(report.repair.afterPhotos, "After") +
        "</div></div></div></section>"
      : "";

    els.drawerBody.innerHTML =
      '<h2 class="detail-title" id="drawer-title">' +
      esc(report.title) +
      '</h2><p class="detail-sub"><span>' +
      icon("map-pin") +
      esc(report.road + " · " + report.location) +
      "</span><span>" +
      icon("calendar") +
      esc("Reported " + ui.relativeTime(report.reportedAt)) +
      '</span></p><div class="journey-card">' +
      ui.journey(report) +
      '</div><section class="detail-block"><div class="detail-block-head"><h3>' +
      icon("camera") +
      'Road damage photos</h3><span class="muted text-sm">' +
      ui.pluralize(photos.length, "photo") +
      " · select to enlarge</span></div><div data-gallery-group=\"evidence\">" +
      photoGallery(photos, "Road damage photos") +
      '</div></section><section class="detail-block detail-columns"><dl class="facts"><div><dt>Severity</dt><dd>' +
      ui.severityBadge(report.severity) +
      "</dd></div><div><dt>Status</dt><dd>" +
      ui.statusPill(report.status) +
      '</dd></div><div><dt>Reporter</dt><dd><span class="person">' +
      ui.avatar(name, "sm") +
      "<span>" +
      esc(name) +
      "</span></span></dd></div><div><dt>Reported on</dt><dd>" +
      esc(ui.formatDate(report.reportedAt)) +
      '</dd></div><div class="facts-wide"><dt>GPS coordinates</dt><dd class="mono">' +
      esc(report.coordinates.lat + ", " + report.coordinates.lng) +
      ' · <a href="' +
      esc(ui.osmUrl(report.coordinates)) +
      '" target="_blank" rel="noreferrer">Open in OpenStreetMap</a></dd></div></dl><div class="detail-map"><div class="map" id="detail-map"></div></div></section>' +
      '<section class="detail-block"><div class="detail-block-head"><h3>' +
      icon("file-text") +
      'Description</h3></div><p class="detail-description">' +
      esc(report.description) +
      "</p></section>" +
      repair +
      '<section class="detail-block"><div class="detail-block-head"><h3>' +
      icon("hard-hat") +
      'Assign team</h3></div><div class="callout assign-box">' +
      assignmentSummary +
      assignmentControl +
      "</div></section>" +
      '<section class="detail-block"><div class="detail-block-head"><h3>' +
      icon("activity") +
      'Activity &amp; notes</h3><span class="muted text-sm">' +
      ui.pluralize(report.history.length, "entry", "entries") +
      "</span></div>" +
      ui.timeline(report) +
      '<form class="note-form" data-note-form><label class="field"><span class="field-label">Internal note <span class="optional">Visible to staff only</span></span><textarea name="note" rows="2" maxlength="1000" placeholder="Add context for the team, e.g. site inspection findings"></textarea></label><div class="note-form-actions"><button class="btn btn-secondary btn-sm" type="submit">' +
      icon("message", "icon-sm") +
      "Add note</button></div></form></section>";

    detailMap = ui.renderMap(els.drawerBody.querySelector("#detail-map"), [report], {
      popup: false,
      zoom: 15,
      emptyMessage: "Location coordinates are unavailable.",
    });

    els.drawerBody.dataset.reportId = reportId;
    if (draft) {
      const newNote = els.drawerBody.querySelector('textarea[name="note"]');
      const newAssign = els.drawerBody.querySelector("[data-assign-select]");
      if (newNote && draft.note) {
        newNote.value = draft.note;
        if (draft.focusNote) {
          newNote.focus({ preventScroll: true });
        }
      }
      if (newAssign && draft.crew) {
        newAssign.value = draft.crew;
      }
      els.drawerBody.scrollTop = draft.scroll;
    }

    const decisions = reviewActions(report);
    els.drawerActions.innerHTML = decisions.length
      ? '<p class="footer-note">Decisions are recorded in the report history.</p>' +
        decisions
          .map(function (decision) {
            return (
              '<button class="btn ' +
              decision.style +
              '" type="button" data-action="status" data-next-status="' +
              esc(decision.status) +
              '">' +
              icon(decision.icon, "icon-sm") +
              esc(decision.label) +
              "</button>"
            );
          })
          .join("")
      : "";
  }

  function openReport(reportId, opener) {
    const isOpening = !els.drawer.classList.contains("is-open");
    if (isOpening) {
      drawerOpener = opener || document.activeElement;
    }
    openReportId = reportId;
    renderDrawer(reportId);
    if (isOpening) {
      els.drawer.classList.add("is-open");
      els.drawerScrim.classList.add("is-open");
      els.drawer.setAttribute("aria-hidden", "false");
      restoreDrawerInert = ui.setBackgroundInert([els.drawer, els.drawerScrim]);
      document.documentElement.style.overflow = "hidden";
      els.drawerBody.scrollTop = 0;
      els.drawerClose.focus({ preventScroll: true });
      window.setTimeout(function () {
        if (detailMap) {
          detailMap.refresh();
        }
      }, 380);
    }
  }

  function closeDrawer(restoreFocus) {
    if (!els.drawer.classList.contains("is-open")) {
      return;
    }
    els.drawer.classList.remove("is-open");
    els.drawerScrim.classList.remove("is-open");
    els.drawer.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
    if (restoreDrawerInert) {
      restoreDrawerInert();
      restoreDrawerInert = null;
    }
    openReportId = null;
    if (restoreFocus !== false && drawerOpener && drawerOpener.isConnected) {
      drawerOpener.focus({ preventScroll: true });
    }
    drawerOpener = null;
  }

  // Review decisions that need a confirmation step before they are saved.
  const statusConfirmations = {
    verified: {
      kicker: "Report review",
      title: "Verify this report?",
      message: function (reportId) {
        return reportId + " will be marked as verified and moved to Assignment.";
      },
      confirmLabel: "Verify report",
      icon: "shield-check",
    },
    rejected: {
      kicker: "Report review",
      title: "Reject this report?",
      message: function (reportId) {
        return reportId + " will be closed and removed from the review queue. This can't be undone.";
      },
      confirmLabel: "Reject report",
      danger: true,
      input: { label: "Reason for rejecting", placeholder: "e.g. No road damage found during inspection", hint: "Shown to the citizen on the tracking page." },
    },
    duplicate: {
      kicker: "Report review",
      title: "Mark as a duplicate?",
      message: function (reportId) {
        return reportId + " will be closed as a duplicate of an existing report. This can't be undone.";
      },
      confirmLabel: "Mark duplicate",
      danger: true,
    },
    resolved: {
      kicker: "Repair review",
      title: "Verify the repair and resolve?",
      message: function (reportId) {
        return "The repair for " + reportId + " will be approved and the report closed.";
      },
      confirmLabel: "Verify and resolve",
      icon: "check-circle",
    },
    in_progress: {
      kicker: "Repair review",
      title: "Request more work?",
      message: function (reportId) {
        return reportId + " will go back to the maintenance crew for more repair work.";
      },
      confirmLabel: "Request more work",
      icon: "reset",
      input: { label: "What still needs to be done?", placeholder: "e.g. The patch edge is uneven; level it with the lane", hint: "The crew sees this note on their job." },
    },
  };

  const statusDescriptions = {
    under_review: "Administrator started reviewing this report.",
    verified: "Administrator confirmed the reported road damage.",
    rejected: "Administrator rejected this report.",
    duplicate: "Administrator marked this report as a duplicate.",
    resolved: "Administrator verified the repair and closed the report.",
    in_progress: "Administrator requested additional repair work.",
  };

  const statusNotifications = {
    under_review: [" is now under review.", "info"],
    verified: [" verified.", "success"],
    rejected: [" rejected.", "success"],
    duplicate: [" marked as a duplicate.", "success"],
    resolved: [" resolved. The repair was verified.", "success"],
    in_progress: [" sent back for more repair work.", "info"],
  };

  function changeReportStatus(reportId, nextStatus, note) {
    if (!findReport(reportId)) {
      throw new Error("This report is no longer available.");
    }
    store.setStatus(reportId, nextStatus, statusDescriptions[nextStatus], currentUser.name, note);
    if (nextStatus !== "under_review") {
      closeDrawer(false);
    }
    const notification = statusNotifications[nextStatus] || [" updated.", "success"];
    ui.showMessage(reportId + notification[0], notification[1]);
    render();
  }

  function decide(reportId, nextStatus, button) {
    const confirmation = statusConfirmations[nextStatus];
    if (!confirmation) {
      runSafely(function () {
        changeReportStatus(reportId, nextStatus);
      });
      return;
    }
    const options = {
      kicker: confirmation.kicker,
      title: confirmation.title,
      message: confirmation.message(reportId),
      confirmLabel: confirmation.confirmLabel,
      danger: confirmation.danger,
      icon: confirmation.icon,
      opener: button,
      input: confirmation.input,
    };
    const request = confirmation.input ? ui.prompt(options) : ui.confirm(options);
    request.then(function (result) {
      if (result === null || result === false) {
        return;
      }
      runSafely(function () {
        changeReportStatus(reportId, nextStatus, typeof result === "string" ? result : "");
      });
    });
  }

  function assignReport(reportId, personnelId) {
    if (!personnelId) {
      throw new Error("Choose a maintenance team before assigning this report.");
    }
    const person = findPerson(personnelId);
    store.assignReport(reportId, personnelId);
    ui.showMessage(reportId + " assigned to " + (person ? person.team : "a maintenance team") + ".", "success");
    render();
  }

  function confirmAssignment(reportId, personnelId, opener) {
    const report = findReport(reportId);
    const person = findPerson(personnelId);
    if (!report || !person) {
      assignReport(reportId, personnelId);
      return;
    }
    const action = report.status === "assigned" ? "Reassign" : "Assign";
    ui.confirm({
      kicker: "Team assignment",
      title: action + " this report?",
      message: action + " " + report.id + " to " + person.team + " (" + person.name + ")?",
      confirmLabel: action + " team",
      icon: "hard-hat",
      opener: opener,
    }).then(function (confirmed) {
      if (!confirmed) {
        return;
      }
      runSafely(function () {
        assignReport(reportId, personnelId);
      });
      window.setTimeout(function () {
        const select = els.drawerBody.querySelector('[data-assign-select="' + CSS.escape(reportId) + '"]');
        const button = select && select.closest(".select-menu") && select.closest(".select-menu").querySelector(".select-menu-button");
        if (button) {
          button.focus({ preventScroll: true });
        }
      }, 0);
    });
  }

  /* ---------- Render all ---------- */

  function render() {
    loadState();
    const total = renderCounts();
    renderDashboard(total);
    renderReports();
    renderAssignments();
    renderUsers();
    renderMapView();
    renderAnalytics();
    if (openReportId && els.drawer.classList.contains("is-open")) {
      if (findReport(openReportId)) {
        renderDrawer(openReportId);
      } else {
        closeDrawer(false);
      }
    }
    shell.refreshNotifications();
  }

  /* ---------- Events ---------- */

  $$("[data-admin-view]").forEach(function (button) {
    button.addEventListener("click", function () {
      showView(button.dataset.adminView);
    });
  });

  document.addEventListener("click", function (event) {
    const switchButton = event.target.closest("[data-switch-view]");
    if (switchButton) {
      showView(switchButton.dataset.switchView);
      return;
    }
    const queueButton = event.target.closest("[data-open-queue]");
    if (queueButton) {
      openQueue(queueButton.dataset.openQueue);
    }
  });

  $("#admin-stats").addEventListener("click", function (event) {
    const card = event.target.closest("[data-kpi]");
    if (!card) {
      return;
    }
    const key = card.dataset.kpi;
    if (key === "review") {
      openQueue("review");
    } else if (key === "in_progress") {
      openQueue("all");
      $("#status-filter").value = "in_progress";
      renderReports();
    } else if (key === "resolved") {
      openQueue("all");
      $("#status-filter").value = "resolved";
      renderReports();
    } else {
      openQueue("all");
    }
  });

  $("#queue-summary").addEventListener("click", function (event) {
    const item = event.target.closest("[data-attention]");
    if (!item) {
      return;
    }
    const queue = item.dataset.attention;
    if (queue === "assign") {
      crewFilter = null;
      $("#manage-search").value = "";
      $("#manage-severity-filter").value = "all";
      $("#manage-status-filter").value = "verified";
      renderAssignments();
      showView("assignments");
    } else if (queue === "high") {
      openQueue("all");
      $("#severity-filter").value = "High";
      renderReports();
    } else {
      openQueue(queue);
    }
  });

  ["#recent-report-rows", "#activity-feed", "#report-table-rows"].forEach(function (selector) {
    $(selector).addEventListener("click", function (event) {
      const target = event.target.closest("[data-report-id]");
      if (target) {
        runSafely(function () {
          openReport(target.dataset.reportId, target.matches("button") ? target : target.querySelector("button") || target);
        });
      }
    });
  });

  bindCardInteractions(els.reportGrid);
  bindCardInteractions(els.assignmentGrid);

  $$("[data-report-tab]").forEach(function (button) {
    button.addEventListener("click", function () {
      setReportTab(button.dataset.reportTab);
    });
  });

  $$("[data-layout]").forEach(function (button) {
    button.addEventListener("click", function () {
      layout = button.dataset.layout;
      writePref(layoutKey, layout);
      renderReports();
    });
  });

  $("#search-reports").addEventListener("input", ui.debounce(function () {
    runSafely(renderReports);
  }, 120));
  ["#severity-filter", "#status-filter", "#sort-reports"].forEach(function (selector) {
    $(selector).addEventListener("change", function () {
      runSafely(renderReports);
    });
  });

  $("#manage-search").addEventListener("input", ui.debounce(function () {
    runSafely(renderAssignments);
  }, 120));
  ["#manage-status-filter", "#manage-severity-filter"].forEach(function (selector) {
    $(selector).addEventListener("change", function () {
      runSafely(renderAssignments);
    });
  });

  $("#crew-workload").addEventListener("click", function (event) {
    const row = event.target.closest("[data-crew]");
    if (row) {
      crewFilter = crewFilter === row.dataset.crew ? null : row.dataset.crew;
      runSafely(renderAssignments);
    }
  });
  $("#assignments-meta").addEventListener("click", function (event) {
    if (event.target.closest("[data-clear-crew]")) {
      crewFilter = null;
      runSafely(renderAssignments);
    }
  });

  $("#map-severity").addEventListener("click", function (event) {
    const chip = event.target.closest("[data-severity]");
    if (!chip) {
      return;
    }
    mapSeverity = chip.dataset.severity;
    $$("#map-severity [data-severity]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button === chip));
    });
    runSafely(renderMapView);
  });
  $("#map-scope").addEventListener("change", function () {
    runSafely(renderMapView);
  });
  els.mapList.addEventListener("click", function (event) {
    const item = event.target.closest("[data-map-focus]");
    if (item && adminMap) {
      highlightMapItem(item.dataset.mapFocus);
      adminMap.focus(item.dataset.mapFocus);
    }
  });
  $("#refresh-map").addEventListener("click", function () {
    runSafely(function () {
      loadState();
      renderMapView();
      if (adminMap) {
        adminMap.refresh();
      }
      ui.showMessage("Map updated with the latest reports.", "info");
    });
  });

  $("#analytics-range").addEventListener("change", function () {
    runSafely(renderAnalytics);
  });
  $("#export-csv").addEventListener("click", function () {
    runSafely(exportCsv);
  });
  $("#print-report").addEventListener("click", function () {
    window.print();
  });

  $$("[data-users-tab]").forEach(function (button) {
    button.addEventListener("click", function () {
      setUsersTab(button.dataset.usersTab);
    });
  });
  $("#citizen-search").addEventListener("input", ui.debounce(function () {
    runSafely(renderUsers);
  }, 120));

  $("#personnel-rows").addEventListener("click", function (event) {
    const button = event.target.closest('[data-action="delete-person"]');
    if (!button) {
      return;
    }
    runSafely(function () {
      const person = findPerson(button.dataset.userId);
      if (!person) {
        throw new Error("This maintenance account is no longer available.");
      }
      if (crewStats(person).open > 0) {
        throw new Error("Reassign or finish this person's open jobs before deleting the account.");
      }
      ui.confirm({
        kicker: "Maintenance account",
        title: "Delete this account?",
        message: person.name + "'s maintenance account (" + person.team + ") will be permanently deleted.",
        confirmLabel: "Delete account",
        danger: true,
        icon: "trash",
        opener: button,
      }).then(function (confirmed) {
        if (!confirmed) {
          return;
        }
        store
          .deletePersonnel(person.id)
          .then(function () {
            if (crewFilter === person.id) {
              crewFilter = null;
            }
            ui.showMessage(person.name + "'s maintenance account was deleted.", "success");
            render();
          })
          .catch(function (error) {
            ui.showMessage(error.message, "error");
          });
      });
    });
  });

  function setCitizenActive(userId, active) {
    const citizen = store.setCitizenActive(userId, active);
    ui.showMessage(
      citizen.name + "'s account is now " + (citizen.active ? "active." : "inactive."),
      citizen.active ? "success" : "info",
    );
    render();
  }

  $("#citizen-rows").addEventListener("click", function (event) {
    const button = event.target.closest('[data-action="toggle-citizen"]');
    if (!button) {
      return;
    }
    const userId = button.dataset.userId;
    if (button.dataset.active !== "true") {
      runSafely(function () {
        setCitizenActive(userId, true);
      });
      return;
    }
    runSafely(function () {
      const citizen = state.citizens.find(function (item) {
        return item.id === userId;
      });
      if (!citizen) {
        throw new Error("This citizen account is no longer available.");
      }
      ui.confirm({
        kicker: "Citizen account",
        title: "Deactivate this account?",
        message: citizen.name + "'s account will be deactivated and they won't be able to sign in or submit reports. You can reactivate it later.",
        confirmLabel: "Deactivate account",
        danger: true,
        icon: "user-x",
        opener: button,
      }).then(function (confirmed) {
        if (confirmed) {
          runSafely(function () {
            setCitizenActive(userId, false);
          });
        }
      });
    });
  });

  els.personnelForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!els.personnelForm.reportValidity()) {
      return;
    }
    const submitButton = els.personnelForm.querySelector('button[type="submit"]');
    if (submitButton.classList.contains("is-loading")) {
      return;
    }
    const values = new FormData(els.personnelForm);
    submitButton.classList.add("is-loading");
    store
      .addPersonnel({
        name: values.get("name"),
        email: values.get("email"),
        team: values.get("team"),
      })
      .then(function (person) {
        els.personnelForm.reset();
        ui.showMessage(person.name + "'s maintenance account was added. They sign in with crew123.", "success");
        render();
      })
      .catch(function (error) {
        ui.showMessage(error.message, "error");
      })
      .finally(function () {
        submitButton.classList.remove("is-loading");
      });
  });

  // Drawer
  els.drawerBody.addEventListener("click", function (event) {
    const photoButton = event.target.closest("[data-gallery-index]");
    if (photoButton) {
      const group = photoButton.closest("[data-gallery-group]");
      const images = Array.from(group.querySelectorAll("[data-gallery-index] img")).map(function (image) {
        return { src: image.currentSrc || image.src, alt: image.alt };
      });
      ui.openLightbox(images, Number(photoButton.dataset.galleryIndex), photoButton);
      return;
    }
    const assignButton = event.target.closest('[data-action="assign"]');
    if (assignButton) {
      runSafely(function () {
        const reportId = assignButton.dataset.reportId;
        const select = els.drawerBody.querySelector('[data-assign-select="' + CSS.escape(reportId) + '"]');
        confirmAssignment(reportId, select && select.value, assignButton);
      });
    }
  });

  els.drawerBody.addEventListener("submit", function (event) {
    const form = event.target.closest("[data-note-form]");
    if (!form) {
      return;
    }
    event.preventDefault();
    runSafely(function () {
      const field = form.elements.namedItem("note");
      store.addNote(openReportId, field.value, currentUser.name);
      field.value = "";
      ui.showMessage("Note added to " + openReportId + ".", "success");
      render();
    });
  });

  els.drawerActions.addEventListener("click", function (event) {
    const button = event.target.closest('[data-action="status"]');
    if (button && openReportId) {
      decide(openReportId, button.dataset.nextStatus, button);
    }
  });

  els.drawerClose.addEventListener("click", function () {
    closeDrawer();
  });
  els.drawerScrim.addEventListener("click", function () {
    closeDrawer();
  });
  $("#drawer-copy").addEventListener("click", function () {
    if (!openReportId) {
      return;
    }
    const link = new URL("track.html?id=" + encodeURIComponent(openReportId), window.location.href).href;
    const done = function () {
      ui.showMessage("Tracking link for " + openReportId + " copied.", "success");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done, function () {
        ui.showMessage(link, "info");
      });
    } else {
      ui.showMessage(link, "info");
    }
  });
  // Dialogs, menus, and the lightbox handle Escape themselves first.
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && els.drawer.classList.contains("is-open")) {
      event.preventDefault();
      closeDrawer();
    }
  });

  window.addEventListener("hashchange", function () {
    const name = window.location.hash.replace("#", "");
    if (viewDetails[name] && name !== currentView) {
      showView(name, { keepHash: true });
    }
  });

  /* ---------- Command palette and notifications ---------- */

  shell.setCommandSource(function (query) {
    const q = query.toLowerCase();
    const pages = Object.keys(viewDetails)
      .filter(function (key) {
        return !q || (viewDetails[key].crumb + " " + viewDetails[key].description).toLowerCase().includes(q);
      })
      .map(function (key) {
        return {
          icon: viewDetails[key].icon,
          title: viewDetails[key].crumb,
          subtitle: viewDetails[key].description,
          run: function () {
            showView(key);
          },
        };
      });
    const reports = state.reports
      .filter(function (report) {
        return !q || matchesQuery(report, q);
      })
      .sort(byNewest)
      .slice(0, q ? 8 : 4)
      .map(function (report) {
        return {
          icon: "file-text",
          title: report.id + " · " + report.title,
          subtitle: report.road + " · " + ui.statusLabel(report.status) + " · " + report.severity + " severity",
          run: function () {
            runSafely(function () {
              openReport(report.id);
            });
          },
        };
      });
    const people = !q
      ? []
      : state.personnel
          .filter(function (person) {
            return (person.name + " " + person.email + " " + person.team).toLowerCase().includes(q);
          })
          .map(function (person) {
            return {
              icon: "hard-hat",
              title: person.name,
              subtitle: person.team + " · " + person.email,
              run: function () {
                setUsersTab("crews");
                showView("users");
              },
            };
          })
          .concat(
            state.citizens
              .filter(function (citizen) {
                return (citizen.name + " " + citizen.email).toLowerCase().includes(q);
              })
              .map(function (citizen) {
                return {
                  icon: "user",
                  title: citizen.name,
                  subtitle: "Citizen · " + citizen.email,
                  run: function () {
                    $("#citizen-search").value = citizen.email;
                    renderUsers();
                    setUsersTab("citizens");
                    showView("users");
                  },
                };
              }),
          )
          .slice(0, 6);
    const actions = [
      { icon: "download", title: "Export reports as CSV", subtitle: "Download every report", run: function () { runSafely(exportCsv); } },
      { icon: "moon", title: "Switch light or dark theme", subtitle: "Change how ResQRoad looks", run: function () { shell.setTheme(shell.currentTheme() === "dark" ? "light" : "dark", true); } },
    ].filter(function (item) {
      return !q || item.title.toLowerCase().includes(q);
    });
    return [
      { label: "Reports", items: reports },
      { label: "Pages", items: pages },
      { label: "People", items: people },
      { label: "Actions", items: actions },
    ];
  });

  shell.setNotificationSource(function () {
    if (!state) {
      return [];
    }
    return recentEvents(25, function (entry) {
      return ["submitted", "in_progress", "repair_submitted"].includes(entry.status) && entry.actor !== currentUser.name && entry.actor !== "Administrator";
    }).map(function (item) {
      return {
        at: item.entry.at,
        status: item.entry.status,
        title: item.report.id + " · " + ui.statusLabel(item.entry.status),
        description: item.report.title,
        meta: (item.entry.actor && item.entry.actor !== "ResQRoad" ? item.entry.actor + " · " : "") + ui.relativeTime(item.entry.at),
        run: function () {
          runSafely(function () {
            openReport(item.report.id);
          });
        },
      };
    });
  }, "admin");

  // Live database updates (from crews, residents, or other admins): refresh.
  store.onExternalChange(function () {
    runSafely(render);
  });

  /* ---------- Start ---------- */

  document.querySelectorAll("[data-current-user]").forEach(function (element) {
    element.textContent = currentUser.name;
  });
  setUsersTab("crews");
  runSafely(function () {
    render();
    setReportTab("review");
    const initial = window.location.hash.replace("#", "");
    showView(viewDetails[initial] ? initial : "dashboard", { keepScroll: true });
    const params = new URLSearchParams(window.location.search);
    const reportParam = params.get("report");
    if (reportParam) {
      // Open a linked report once, then drop the parameter so reloads don't reopen it.
      history.replaceState(null, "", window.location.pathname + window.location.hash);
      if (findReport(reportParam.toUpperCase())) {
        openReport(reportParam.toUpperCase());
      }
    }
  });
})();
