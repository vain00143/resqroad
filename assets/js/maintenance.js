/* Maintenance crew workspace: overview, assigned jobs (start a repair, submit
   notes with after-repair photos), a map of repair sites, and the public
   site. Repair drafts survive re-renders, so typing is never lost when data
   refreshes. */
(async function () {
  "use strict";

  const store = window.RoadWatchStore;
  const ui = window.RoadWatchUI;
  const shell = window.RoadWatchShell;
  const icon = ui.icon;
  const esc = ui.escapeHtml;
  const currentUser = await window.RoadWatchAuth.requireRole("maintenance", "login.html");
  if (!currentUser) {
    return;
  }

  // The server accepts up to ten after-repair photos per repair update.
  const maxPhotos = 10;
  const severityRank = { High: 3, Medium: 2, Low: 1 };
  const jobSteps = ["assigned", "in_progress", "repair_submitted", "resolved"];
  const jobStepLabels = { assigned: "Assigned", in_progress: "Repairing", repair_submitted: "Submitted", resolved: "Verified" };
  const tabStatuses = {
    active: ["assigned", "in_progress"],
    review: ["repair_submitted"],
    done: ["resolved"],
  };
  const viewDetails = {
    overview: { crumb: "Overview", title: "Road maintenance workspace", icon: "dashboard" },
    jobs: { crumb: "My assigned jobs", title: "My assigned jobs", icon: "wrench" },
    map: { crumb: "Repair sites", title: "Repair sites", icon: "map" },
    public: { crumb: "Public site", title: "Public site", icon: "globe" },
  };

  const $ = function (selector) {
    return document.querySelector(selector);
  };
  const $$ = function (selector) {
    return Array.from(document.querySelectorAll(selector));
  };

  const jobList = $("#job-list");
  const drafts = new Map();
  // Completed jobs show only their summary until opened ("View more
  // details"); these are the ones opened.
  const expandedJobs = new Set();
  let state = null;
  let person = null;
  let currentView = "overview";
  let jobTab = "active";
  let overviewMap = null;
  let crewMap = null;

  function runSafely(action) {
    try {
      action();
    } catch (error) {
      console.error("ResQRoad maintenance action failed.", error);
      ui.showMessage(error.message, "error");
    }
  }

  function loadState() {
    state = store.getState();
    person = state.personnel.find(function (item) {
      return item.id === currentUser.userId;
    });
    if (!person) {
      throw new Error("Your maintenance account is no longer available. Sign in again.");
    }
    return state;
  }

  function myJobs() {
    return state.reports.filter(function (report) {
      return report.assignedTo === person.id;
    });
  }

  function lastEvent(report, status) {
    return (report.history || []).slice().reverse().find(function (item) {
      return item.status === status;
    });
  }

  function draftFor(reportId) {
    if (!drafts.has(reportId)) {
      drafts.set(reportId, { notes: "", after: [] });
    }
    return drafts.get(reportId);
  }

  // Jobs most worth doing first: repairs underway, then by severity and age.
  function priority(first, second) {
    const order = { in_progress: 0, assigned: 1, repair_submitted: 2, resolved: 3 };
    return (
      (order[first.status] ?? 4) - (order[second.status] ?? 4) ||
      severityRank[second.severity] - severityRank[first.severity] ||
      Date.parse(first.reportedAt) - Date.parse(second.reportedAt)
    );
  }

  /* ---------- Views ---------- */

  function showView(name, options) {
    if (!viewDetails[name]) {
      return;
    }
    currentView = name;
    $$("[data-crew-view-panel]").forEach(function (panel) {
      panel.hidden = panel.dataset.crewViewPanel !== name;
    });
    $$("[data-crew-view]").forEach(function (button) {
      const active = button.dataset.crewView === name;
      button.classList.toggle("is-active", active);
      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
    $("#crumb-current").textContent = viewDetails[name].crumb;
    document.title = viewDetails[name].title + " | ResQRoad";
    history.replaceState(null, "", "#" + name);
    if (!options || !options.keepScroll) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    runSafely(renderMaps);
    runSafely(renderPublicView);
  }

  /* ---------- Overview ---------- */

  function renderOverview(jobs) {
    const open = jobs.filter(function (report) {
      return report.status !== "resolved" && report.status !== "rejected";
    });
    const inProgress = jobs.filter(function (report) {
      return report.status === "in_progress";
    }).length;
    const awaiting = jobs.filter(function (report) {
      return report.status === "repair_submitted";
    }).length;
    const completed = jobs.filter(function (report) {
      return report.status === "resolved";
    }).length;
    const notStarted = jobs.filter(function (report) {
      return report.status === "assigned";
    }).length;

    const hour = new Date().getHours();
    $("[data-greeting]").textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    $("[data-first-name]").textContent = person.name.split(" ")[0];
    $("[data-today]").textContent = person.team + " · " + new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    $("#overview-summary").textContent = open.length
      ? "You have " + ui.pluralize(open.length, "open job") + (notStarted ? ", " + notStarted + " not started yet." : ".")
      : "No open jobs right now. New assignments will appear here.";

    $("#job-summary").innerHTML = [
      { label: "Open assigned jobs", value: open.length, icon: "clipboard-list", tone: "var(--accent)", foot: ui.pluralize(notStarted, "job") + " waiting to start", tab: "active" },
      { label: "In progress", value: inProgress, icon: "construction", tone: "var(--st-in_progress)", foot: "Repairs underway", tab: "active" },
      { label: "Awaiting admin review", value: awaiting, icon: "clock", tone: "var(--st-repair_submitted)", foot: "Submitted for verification", tab: "review" },
      { label: "Completed", value: completed, icon: "check-circle", tone: "var(--success)", foot: "Verified by the administrator", tab: "done" },
    ]
      .map(function (item) {
        return (
          '<button class="card kpi" type="button" data-kpi-tab="' +
          item.tab +
          '"><span class="kpi-top"><span class="kpi-label">' +
          esc(item.label) +
          '</span><span class="kpi-icon" style="--tone:' +
          item.tone +
          '">' +
          icon(item.icon) +
          '</span></span><span class="kpi-value">' +
          item.value +
          '</span><span class="kpi-foot">' +
          esc(item.foot) +
          "</span></button>"
        );
      })
      .join("");

    const next = jobs
      .filter(function (report) {
        return report.status === "assigned" || report.status === "in_progress";
      })
      .sort(priority)[0];
    if (!next) {
      $("#next-job").innerHTML =
        '<div class="empty"><span class="empty-icon">' +
        icon("check-circle") +
        "</span><h3>You're all caught up</h3><p>When an administrator assigns a verified report, it will appear here.</p></div>";
    } else {
      // The job fills the card: photo on the left, then what, where, the
      // progress, and the actions.
      const photo = ui.reportPhotos(next)[0];
      const assigned = lastEvent(next, "assigned");
      $("#next-job").innerHTML =
        '<div class="next-job"><div class="next-job-media">' +
        ui.photoImg(photo) +
        '</div><div class="next-job-body"><div><div class="toolbar-group"><span class="id-tag">' +
        esc(next.id) +
        "</span>" +
        ui.severityBadge(next.severity) +
        ui.statusPill(next.status) +
        "</div><h3>" +
        esc(next.title) +
        '</h3><p class="job-meta" style="margin: 0"><span>' +
        icon("map-pin") +
        esc(next.road + " · " + next.location) +
        "</span>" +
        (assigned ? "<span>" + icon("calendar") + "Assigned " + esc(ui.formatDay(assigned.at)) + "</span>" : "") +
        '</p></div><p class="detail-description">' +
        esc(next.description) +
        '</p><div class="job-progress">' +
        ui.journey(next, { steps: jobSteps, labels: jobStepLabels }) +
        '</div><div class="job-actions">' +
        (next.status === "assigned"
          ? '<button class="btn btn-primary btn-sm" type="button" data-action="start" data-report-id="' + esc(next.id) + '">' + icon("play", "icon-sm") + "Start repair</button>"
          : '<button class="btn btn-primary btn-sm" type="button" data-open-job="' + esc(next.id) + '">' + icon("wrench", "icon-sm") + "Continue repair</button>") +
        '<a class="btn btn-secondary btn-sm" href="' +
        esc(ui.directionsUrl(next.coordinates)) +
        '" target="_blank" rel="noreferrer">' +
        icon("navigation", "icon-sm") +
        "Directions</a></div></div></div>";
    }

    const events = [];
    jobs.forEach(function (report) {
      (report.history || []).forEach(function (entry) {
        if (["assigned", "in_progress", "repair_submitted", "resolved"].includes(entry.status)) {
          events.push({ report: report, entry: entry });
        }
      });
    });
    events.sort(function (first, second) {
      return Date.parse(second.entry.at) - Date.parse(first.entry.at);
    });
    $("#crew-activity").innerHTML = events.length
      ? '<ol class="timeline">' +
        events
          .slice(0, 8)
          .map(function (item) {
            return (
              '<li class="timeline-item"><span class="timeline-dot status-' +
              esc(item.entry.status) +
              '" aria-hidden="true"></span><span class="timeline-title"><button class="link-button" type="button" data-open-job="' +
              esc(item.report.id) +
              '">' +
              esc(item.report.id) +
              "</button> · " +
              esc(item.entry.description) +
              "</span>" +
              (item.entry.note ? '<p class="timeline-note">' + esc(item.entry.note) + "</p>" : "") +
              '<span class="timeline-meta">' +
              esc(ui.relativeTime(item.entry.at)) +
              "</span></li>"
            );
          })
          .join("") +
        "</ol>"
      : '<p class="muted text-sm">No updates yet.</p>';
  }

  /* ---------- Jobs ---------- */

  function setJobTab(tab) {
    jobTab = tab;
    $$("[data-job-tab]").forEach(function (button) {
      button.setAttribute("aria-selected", String(button.dataset.jobTab === tab));
    });
  }

  function photoCountText(count) {
    return count ? count + " of " + maxPhotos + " added" : "Up to " + maxPhotos;
  }

  function thumbList(photos, field, reportId) {
    return photos
      .map(function (photo, index) {
        return (
          '<li class="thumb">' +
          (photo.src
            ? '<img src="' + esc(photo.src) + '" alt="" />'
            : '<span class="thumb-placeholder">' + icon("image") + "</span>") +
          "<span>" +
          esc(photo.name) +
          '</span><button class="thumb-remove" type="button" data-remove-photo="' +
          index +
          '" data-field="' +
          field +
          '" data-report-id="' +
          esc(reportId) +
          '" aria-label="Remove ' +
          esc(photo.name) +
          '">' +
          icon("x") +
          "</button></li>"
        );
      })
      .join("");
  }

  function dropzone(field, label, reportId) {
    return (
      '<div class="photo-field"><span class="field-label">' +
      label +
      ' <span class="optional" data-photo-count="' +
      field +
      '">' +
      photoCountText(draftFor(reportId)[field].length) +
      '</span></span><label class="dropzone"><input type="file" name="' +
      field +
      '-photos" accept="image/*" multiple data-photo-input="' +
      field +
      '" aria-label="Add ' +
      label.toLowerCase() +
      '" /><span class="dropzone-icon">' +
      icon("camera") +
      "</span><strong>Add " +
      label.toLowerCase() +
      "</strong><span>Drop images here or browse</span></label>" +
      '<ul class="thumb-list" data-preview="' +
      field +
      '" aria-live="polite">' +
      thumbList(draftFor(reportId)[field], field, reportId) +
      "</ul></div>"
    );
  }

  function renderJobCard(report) {
    const photos = ui.reportPhotos(report);
    const assigned = lastEvent(report, "assigned");
    const sentBack = report.status === "in_progress" && report.repair ? lastEvent(report, "in_progress") : null;
    const draft = draftFor(report.id);

    const feedback =
      sentBack && sentBack.actor !== person.name
        ? '<div class="feedback">' +
          icon("alert-triangle") +
          "<div><strong>More work requested by the administrator</strong>" +
          esc(sentBack.note || "The previous repair was not accepted. Review the site and submit an updated repair.") +
          "</div></div>"
        : "";

    const startButton =
      report.status === "assigned"
        ? '<button class="btn btn-primary" type="button" data-action="start" data-report-id="' +
          esc(report.id) +
          '">' +
          icon("play", "icon-sm") +
          "Start repair</button>"
        : "";

    const repairForm =
      report.status === "in_progress"
        ? '<form class="repair-form" data-repair-form data-report-id="' +
          esc(report.id) +
          '" novalidate><h4>' +
          icon("wrench") +
          'Submit repair update</h4><label class="field"><span class="field-label">Repair notes</span><textarea name="notes" rows="3" maxlength="1000" placeholder="Describe the inspection and repair work completed">' +
          esc(draft.notes) +
          "</textarea></label>" +
          dropzone("after", "After-repair photos", report.id) +
          '<p class="field-hint">Add at least one photo of the finished repair. The resident\'s photos of the damage are already on the report, so the administrator can compare them. Photos are resized before they are saved.</p><div class="job-actions"><button class="btn btn-primary" type="submit">' +
          icon("send", "icon-sm") +
          "Submit repair for review</button></div></form>"
        : "";

    const afterPhotos = report.repair ? ui.repairPhotos(report, "after") : [];
    const receipt = report.repair
      ? '<div class="callout callout-tone"><div class="detail-block-head"><h3>' +
        icon("wrench") +
        (report.status === "in_progress" ? "Previous repair update" : "Repair update") +
        '</h3><span class="muted text-sm">' +
        esc(report.repair.submittedAt ? ui.formatDate(report.repair.submittedAt) : "") +
        '</span></div><p class="detail-description">' +
        esc(report.repair.notes) +
        '</p><div class="repair-photos"><h4>After-repair photos <span>' +
        esc(ui.pluralize(afterPhotos.length, "photo")) +
        "</span></h4>" +
        ui.photoGallery(afterPhotos, "After-repair photos", "gallery-grid") +
        "</div>" +
        (report.status === "repair_submitted"
          ? '<p class="field-hint" style="margin-top: 0.75rem">This repair is waiting for an administrator to verify it.</p>'
          : "") +
        "</div>"
      : "";

    // A completed job is a short summary until "View more details".
    const collapsible = report.status === "resolved";
    const collapsed = collapsible && !expandedJobs.has(report.id);
    const toggle = collapsible
      ? '<button class="job-toggle" type="button" data-toggle-job="' +
        esc(report.id) +
        '" aria-expanded="' +
        String(!collapsed) +
        '" aria-controls="job-body-' +
        esc(report.id) +
        '">' +
        (collapsed ? "View more details" : "Hide details") +
        '<span class="visually-hidden"> of ' +
        esc(report.id) +
        "</span>" +
        icon("chevron-down", "icon-sm") +
        "</button>"
      : "";

    return (
      '<article class="card job-card' +
      (collapsed ? " is-collapsed" : "") +
      '" tabindex="-1" id="job-' +
      esc(report.id) +
      '" data-job-card="' +
      esc(report.id) +
      '"><div class="job-head"><button class="job-thumb" type="button" data-job-photos="' +
      esc(report.id) +
      '" aria-label="View ' +
      photos.length +
      " road damage photos for " +
      esc(report.id) +
      '">' +
      ui.photoImg(photos[0]) +
      '</button><div><div class="toolbar-group"><span class="id-tag">' +
      esc(report.id) +
      "</span>" +
      ui.severityBadge(report.severity) +
      '</div><h3 class="job-title">' +
      esc(report.title) +
      '</h3><div class="job-meta"><span>' +
      icon("map-pin") +
      esc(report.road + " · " + report.location) +
      "</span>" +
      (assigned ? "<span>" + icon("calendar") + "Assigned " + esc(ui.formatDay(assigned.at)) + "</span>" : "") +
      "</div></div>" +
      ui.statusPill(report.status) +
      '</div><div class="job-body" id="job-body-' +
      esc(report.id) +
      '"' +
      (collapsed ? " hidden" : "") +
      '><div class="job-progress">' +
      ui.journey(report, { steps: jobSteps, labels: jobStepLabels }) +
      "</div>" +
      feedback +
      '<p class="detail-description">' +
      esc(report.description) +
      '</p><div class="job-actions">' +
      startButton +
      '<a class="btn btn-secondary btn-sm" href="' +
      esc(ui.directionsUrl(report.coordinates)) +
      '" target="_blank" rel="noreferrer">' +
      icon("navigation", "icon-sm") +
      'Get directions</a><a class="btn btn-secondary btn-sm" href="' +
      esc(ui.osmUrl(report.coordinates)) +
      '" target="_blank" rel="noreferrer">' +
      icon("map", "icon-sm") +
      "Open coordinates in OpenStreetMap</a>" +
      '<span class="muted text-sm mono" style="align-self: center">GPS: ' +
      esc(report.coordinates.lat + ", " + report.coordinates.lng) +
      "</span></div>" +
      repairForm +
      receipt +
      "</div>" +
      toggle +
      "</article>"
    );
  }

  function renderJobs(jobs) {
    const counts = {
      active: 0,
      review: 0,
      done: 0,
      all: jobs.length,
    };
    jobs.forEach(function (report) {
      Object.keys(tabStatuses).forEach(function (tab) {
        if (tabStatuses[tab].includes(report.status)) {
          counts[tab] += 1;
        }
      });
    });
    Object.keys(counts).forEach(function (key) {
      $$('[data-count="' + key + '"]').forEach(function (element) {
        element.textContent = counts[key];
      });
    });
    const badge = $('[data-nav-count="jobs"]');
    badge.textContent = counts.active || "";
    badge.dataset.value = String(counts.active);
    $("#job-description").textContent = person.name + " · " + person.team;

    // Keep anything typed in an open repair form.
    jobList.querySelectorAll("form[data-repair-form]").forEach(function (form) {
      draftFor(form.dataset.reportId).notes = form.elements.namedItem("notes").value;
    });

    const query = $("#job-search").value.trim().toLowerCase();
    const visible = jobs
      .filter(function (report) {
        return jobTab === "all" || tabStatuses[jobTab].includes(report.status);
      })
      .filter(function (report) {
        return [report.id, report.title, report.road, report.location].join(" ").toLowerCase().includes(query);
      })
      .sort(priority);

    if (visible.length === 0) {
      let title = "No jobs here";
      let text = "Jobs in this list will appear here.";
      if (jobs.length === 0) {
        title = "No jobs assigned yet";
        text = "When an administrator assigns a verified report, it will appear here.";
      } else if (query) {
        title = "No jobs match your search";
        text = "Try searching for a different report or road.";
      } else if (jobTab === "active") {
        title = "No active jobs";
        text = "Nice work. Check the other tabs for submitted and completed repairs.";
      } else if (jobTab === "review") {
        title = "Nothing awaiting review";
        text = "Repairs you submit appear here until an administrator verifies them.";
      } else if (jobTab === "done") {
        title = "No completed repairs yet";
        text = "Repairs verified by an administrator are listed here.";
      }
      jobList.innerHTML =
        '<div class="card empty"><span class="empty-icon">' +
        icon(query ? "search" : "inbox") +
        "</span><h3>" +
        esc(title) +
        "</h3><p>" +
        esc(text) +
        "</p></div>";
      return;
    }

    jobList.innerHTML = visible.map(renderJobCard).join("");
  }

  /* ---------- Maps ---------- */

  function renderMaps() {
    if (!state) {
      return;
    }
    const jobs = myJobs().sort(priority);
    const mapOptions = {
      emptyMessage: "No maintenance jobs are assigned to you yet.",
      action: "job",
      actionLabel: "Open job",
      onAction: function (action, reportId) {
        focusJob(reportId);
      },
      pulse: function (report) {
        return report.status === "assigned" || report.status === "in_progress";
      },
    };
    if (currentView === "overview") {
      overviewMap = ui.renderMap($("#maintenance-map"), jobs, mapOptions);
      $("#overview-legend").innerHTML = ui.mapLegend();
    }
    if (currentView === "map") {
      crewMap = ui.renderMap(
        $("#crew-map"),
        jobs,
        Object.assign({}, mapOptions, {
          onSelect: function (reportId) {
            $$("#crew-map-list [data-map-focus]").forEach(function (item) {
              item.classList.toggle("is-active", item.dataset.mapFocus === reportId);
            });
          },
        }),
      );
      $("#crew-map-legend").innerHTML = ui.mapLegend();
      $("#crew-map-count").textContent = ui.pluralize(jobs.length, "job") + " assigned to you";
      $("#crew-map-list").innerHTML = jobs.length
        ? jobs
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
                "</span></small></button></li>"
              );
            })
            .join("")
        : '<li class="empty"><p>No jobs assigned yet.</p></li>';
    }
  }

  // Shows a job card in the jobs list, switching tabs if needed.
  function focusJob(reportId) {
    const report = myJobs().find(function (item) {
      return item.id === reportId;
    });
    if (!report) {
      ui.showMessage("This job is no longer assigned to you.", "error");
      return;
    }
    // A completed job opens with all its details.
    expandedJobs.add(reportId);
    $("#job-search").value = "";
    const tab =
      Object.keys(tabStatuses).find(function (key) {
        return tabStatuses[key].includes(report.status);
      }) || "all";
    setJobTab(tab);
    showView("jobs");
    render();
    const card = jobList.querySelector('[data-job-card="' + CSS.escape(reportId) + '"]');
    if (card) {
      card.classList.add("is-highlight");
      window.setTimeout(function () {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.focus({ preventScroll: true });
      }, 60);
      window.setTimeout(function () {
        card.classList.remove("is-highlight");
      }, 2600);
    }
  }

  /* ---------- Public site ---------- */

  // The public site inside the workspace. Only the crew's own jobs open from
  // it; other reports are shown as the public sees them.
  function renderPublicView() {
    if (currentView !== "public" || !state) {
      return;
    }
    window.RoadWatchPublicView.render($("#public-view"), state, {
      canOpen: function (report) {
        return report.assignedTo === person.id;
      },
      openLabel: "Open job",
      onOpen: function (reportId) {
        focusJob(reportId);
      },
    });
  }

  /* ---------- Render ---------- */

  function render() {
    loadState();
    const jobs = myJobs();
    document.querySelectorAll("[data-current-user]").forEach(function (element) {
      element.textContent = person.name;
    });
    $("[data-current-team]").textContent = person.team;
    $("[data-current-email]").textContent = person.email || "";
    const avatar = $("[data-user-avatar]");
    avatar.textContent = ui.initials(person.name);
    avatar.dataset.tone = String(ui.initials(person.name).charCodeAt(0) % 6 + 1);
    renderOverview(jobs);
    renderJobs(jobs);
    renderMaps();
    renderPublicView();
    shell.refreshNotifications();
  }

  /* ---------- Photos ---------- */

  function refreshThumbs(form, field) {
    const reportId = form.dataset.reportId;
    const photos = draftFor(reportId)[field];
    form.querySelector('[data-preview="' + field + '"]').innerHTML = thumbList(photos, field, reportId);
    const count = form.querySelector('[data-photo-count="' + field + '"]');
    if (count) {
      count.textContent = photoCountText(photos.length);
    }
  }

  function addPhotos(input) {
    const form = input.closest("form[data-repair-form]");
    const field = input.dataset.photoInput;
    const draft = draftFor(form.dataset.reportId);
    const files = Array.from(input.files || []);
    input.value = "";
    const room = maxPhotos - draft[field].length;
    if (room <= 0) {
      ui.showMessage("You can add up to " + maxPhotos + " after-repair photos.", "error");
      return;
    }
    if (files.length > room) {
      ui.showMessage("Only the first " + room + " photo" + (room === 1 ? "" : "s") + " were added (limit " + maxPhotos + ").", "info");
    }
    Promise.all(
      files.slice(0, room).map(function (file) {
        return ui.readImageFile(file).catch(function (error) {
          ui.showMessage(error.message, "error");
          return null;
        });
      }),
    ).then(function (photos) {
      photos.filter(Boolean).forEach(function (photo) {
        draft[field].push(photo);
      });
      const liveForm = jobList.querySelector('form[data-report-id="' + CSS.escape(form.dataset.reportId) + '"]');
      if (liveForm) {
        refreshThumbs(liveForm, field);
      }
    });
  }

  /* ---------- Events ---------- */

  $$("[data-crew-view]").forEach(function (button) {
    button.addEventListener("click", function () {
      showView(button.dataset.crewView);
    });
  });

  document.addEventListener("click", function (event) {
    const switcher = event.target.closest("[data-switch-view]");
    if (switcher) {
      showView(switcher.dataset.switchView);
      return;
    }
    const opener = event.target.closest("[data-open-job]");
    if (opener) {
      focusJob(opener.dataset.openJob);
      return;
    }
    const kpi = event.target.closest("[data-kpi-tab]");
    if (kpi) {
      $("#job-search").value = "";
      setJobTab(kpi.dataset.kpiTab);
      showView("jobs");
      runSafely(render);
      return;
    }
    const start = event.target.closest('[data-action="start"]');
    if (start) {
      runSafely(function () {
        store.startRepair(start.dataset.reportId, currentUser.userId);
        ui.showMessage("Repair started on " + start.dataset.reportId + ".", "success");
        if (currentView === "overview") {
          focusJob(start.dataset.reportId);
        } else {
          render();
        }
      });
    }
  });

  $$("[data-job-tab]").forEach(function (button) {
    button.addEventListener("click", function () {
      setJobTab(button.dataset.jobTab);
      runSafely(render);
    });
  });

  $("#job-search").addEventListener(
    "input",
    ui.debounce(function () {
      runSafely(render);
    }, 120),
  );

  // Both maps' refresh buttons reload every job from the server.
  $$("[data-refresh-map]").forEach(function (button) {
    button.addEventListener("click", function () {
      ui.refreshMap(button, function () {
        runSafely(render);
        [overviewMap, crewMap].forEach(function (map) {
          if (map) {
            map.refresh();
          }
        });
      });
    });
  });

  $("#crew-map-list").addEventListener("click", function (event) {
    const item = event.target.closest("[data-map-focus]");
    if (item && crewMap) {
      $$("#crew-map-list [data-map-focus]").forEach(function (element) {
        element.classList.toggle("is-active", element === item);
      });
      crewMap.focus(item.dataset.mapFocus);
    }
  });

  jobList.addEventListener("click", function (event) {
    const toggle = event.target.closest("[data-toggle-job]");
    if (toggle) {
      const reportId = toggle.dataset.toggleJob;
      if (expandedJobs.has(reportId)) {
        expandedJobs.delete(reportId);
      } else {
        expandedJobs.add(reportId);
      }
      runSafely(render);
      const again = jobList.querySelector('[data-toggle-job="' + CSS.escape(reportId) + '"]');
      if (again) {
        again.focus({ preventScroll: true });
      }
      return;
    }
    const photos = event.target.closest("[data-job-photos]");
    if (photos) {
      const report = myJobs().find(function (item) {
        return item.id === photos.dataset.jobPhotos;
      });
      if (report) {
        ui.openLightbox(ui.reportPhotos(report), 0, photos);
      }
      return;
    }
    const galleryItem = event.target.closest("[data-gallery-index]");
    if (galleryItem) {
      const group = galleryItem.closest("[data-gallery-group]");
      const images = Array.from(group.querySelectorAll("img")).map(function (image) {
        return { src: image.currentSrc || image.src, alt: image.alt };
      });
      ui.openLightbox(images, Number(galleryItem.dataset.galleryIndex), galleryItem);
      return;
    }
    const remove = event.target.closest("[data-remove-photo]");
    if (remove) {
      const draft = draftFor(remove.dataset.reportId);
      draft[remove.dataset.field].splice(Number(remove.dataset.removePhoto), 1);
      refreshThumbs(remove.closest("form"), remove.dataset.field);
    }
  });

  jobList.addEventListener("input", function (event) {
    const form = event.target.closest("form[data-repair-form]");
    if (form && event.target.name === "notes") {
      draftFor(form.dataset.reportId).notes = event.target.value;
    }
  });

  jobList.addEventListener("change", function (event) {
    if (event.target.matches("[data-photo-input]")) {
      addPhotos(event.target);
    }
  });

  ["dragenter", "dragover"].forEach(function (type) {
    jobList.addEventListener(type, function (event) {
      const zone = event.target.closest(".dropzone");
      if (zone) {
        zone.classList.add("is-dragging");
      }
    });
  });
  ["dragleave", "drop"].forEach(function (type) {
    jobList.addEventListener(type, function (event) {
      const zone = event.target.closest(".dropzone");
      if (zone) {
        zone.classList.remove("is-dragging");
      }
    });
  });

  jobList.addEventListener("submit", function (event) {
    const form = event.target.closest("form[data-repair-form]");
    if (!form) {
      return;
    }
    event.preventDefault();
    const reportId = form.dataset.reportId;
    const draft = draftFor(reportId);
    draft.notes = form.elements.namedItem("notes").value;
    if (!draft.notes.trim() || draft.after.length === 0) {
      ui.showMessage("Add repair notes and at least one after-repair photo.", "error");
      if (!draft.notes.trim()) {
        form.elements.namedItem("notes").focus();
      }
      return;
    }

    ui.confirm({
      kicker: "Repair update",
      title: "Submit this repair for review?",
      message: reportId + " will be sent to an administrator to verify the repair.",
      confirmLabel: "Submit repair",
      icon: "send",
      opener: event.submitter || form.querySelector('button[type="submit"]'),
    }).then(function (confirmed) {
      if (!confirmed) {
        return;
      }
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.classList.add("is-loading");
      let request;
      try {
        request = store.submitRepair(reportId, currentUser.userId, {
          notes: draft.notes,
          afterPhotos: draft.after,
        });
      } catch (error) {
        submitButton.classList.remove("is-loading");
        ui.showMessage(error.message, "error");
        return;
      }
      request
        .then(function () {
          drafts.delete(reportId);
          ui.showMessage(reportId + " sent to the administrator for verification.", "success");
          runSafely(render);
        })
        .catch(function (error) {
          // The draft is kept, so the crew can simply try again.
          submitButton.classList.remove("is-loading");
          ui.showMessage(error.message, "error");
        });
    });
  });

  store.onExternalChange(function () {
    runSafely(render);
  });

  shell.setCommandSource(function (query) {
    const q = query.toLowerCase();
    const pages = Object.keys(viewDetails)
      .filter(function (key) {
        return !q || viewDetails[key].crumb.toLowerCase().includes(q);
      })
      .map(function (key) {
        return {
          icon: viewDetails[key].icon,
          title: viewDetails[key].crumb,
          run: function () {
            showView(key);
          },
        };
      });
    const jobs = myJobs()
      .filter(function (report) {
        return !q || [report.id, report.title, report.road, report.location].join(" ").toLowerCase().includes(q);
      })
      .sort(priority)
      .slice(0, 8)
      .map(function (report) {
        return {
          icon: "wrench",
          title: report.id + " · " + report.title,
          subtitle: report.road + " · " + ui.statusLabel(report.status),
          run: function () {
            focusJob(report.id);
          },
        };
      });
    return [
      { label: "My jobs", items: jobs },
      { label: "Pages", items: pages },
    ];
  });

  shell.setNotificationSource(function () {
    if (!state || !person) {
      return [];
    }
    const items = [];
    myJobs().forEach(function (report) {
      (report.history || []).forEach(function (entry) {
        const fromAdmin = entry.actor !== person.name;
        if (fromAdmin && ["assigned", "in_progress", "resolved"].includes(entry.status)) {
          items.push({
            at: entry.at,
            status: entry.status,
            title:
              report.id +
              " · " +
              (entry.status === "assigned"
                ? "New assignment"
                : entry.status === "resolved"
                  ? "Repair verified"
                  : "More work requested"),
            description: report.title,
            meta: ui.relativeTime(entry.at),
            run: function () {
              focusJob(report.id);
            },
          });
        }
      });
    });
    return items.sort(function (first, second) {
      return Date.parse(second.at) - Date.parse(first.at);
    });
  }, "crew-" + currentUser.userId);

  // Section anchors from the earlier single-page layout still work.
  const legacyAnchors = {
    "maintenance-overview": "overview",
    "maintenance-jobs": "jobs",
    "maintenance-locations": "map",
  };

  runSafely(function () {
    render();
    let initial = window.location.hash.replace("#", "");
    initial = legacyAnchors[initial] || initial;
    showView(viewDetails[initial] ? initial : "overview", { keepScroll: true });
  });
})();
