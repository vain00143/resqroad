/* Citizen portal: report road damage (with a map pin and photos), follow the
   reports you've filed and open their details, and — without leaving the
   portal — track a report by ID, browse the live map, and see the public
   site. Status changes made by staff show up live, with a notification. */
(async function () {
  "use strict";

  const store = window.RoadWatchStore;
  const ui = window.RoadWatchUI;
  const publicView = window.RoadWatchPublicView;
  const icon = ui.icon;
  const esc = ui.escapeHtml;
  const currentUser = await window.RoadWatchAuth.requireRole("citizen", "login.html");
  if (!currentUser) {
    return;
  }

  const maxPhotos = 5;
  const recentKey = "resqroad-recent-tracks";
  const bulacan = { south: 14.5, north: 15.2, west: 120.3, east: 121.2 };
  const severityRank = { High: 3, Medium: 2, Low: 1 };
  const $ = function (selector) {
    return document.querySelector(selector);
  };
  const $$ = function (selector) {
    return Array.from(document.querySelectorAll(selector));
  };

  const form = $("#report-form");
  const errorBox = $("#report-error");
  const latInput = form.elements.namedItem("latitude");
  const lngInput = form.elements.namedItem("longitude");
  const drawer = {
    panel: $("#report-drawer"),
    scrim: $("#drawer-scrim"),
    meta: $("#drawer-meta"),
    body: $("#drawer-body"),
    actions: $("#drawer-actions"),
    close: $("#drawer-close"),
  };
  let state = null;
  let citizen = null;
  let photos = [];
  let picker = null;
  let myFilter = "all";
  let knownStatuses = new Map();
  let currentView = "report";
  let trackId = "";
  let trackMap = null;
  let liveMap = null;
  let liveSeverity = "all";
  let openReportId = null;
  let drawerOpener = null;
  let restoreDrawerInert = null;
  let detailMap = null;

  function loadState() {
    state = store.getState();
    citizen = state.citizens.find(function (item) {
      return item.id === currentUser.userId;
    });
    if (!citizen || citizen.active === false) {
      window.RoadWatchAuth.signOut("login.html?signedout=1");
      throw new Error("Your account is no longer active.");
    }
    return state;
  }

  function myReports() {
    return store.reportsByCitizen(citizen, state).sort(function (first, second) {
      return Date.parse(second.reportedAt) - Date.parse(first.reportedAt);
    });
  }

  /* ---------- Header and stats ---------- */

  function renderHeader() {
    $$("[data-current-user]").forEach(function (element) {
      element.textContent = citizen.name;
    });
    $$("[data-current-email]").forEach(function (element) {
      element.textContent = citizen.email;
    });
    const hour = new Date().getHours();
    $("[data-greeting]").textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    $("[data-first-name]").textContent = citizen.name.split(" ")[0];
    $("[data-today]").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const avatar = $("[data-user-avatar]");
    avatar.textContent = ui.initials(citizen.name);
    avatar.dataset.tone = "2";

    const reports = myReports();
    const count = function (test) {
      return reports.filter(test).length;
    };
    const open = count(function (report) {
      return store.openStatuses.includes(report.status);
    });
    const fixed = count(function (report) {
      return report.status === "resolved";
    });
    const closed = count(function (report) {
      return ["rejected", "duplicate"].includes(report.status);
    });
    $("#citizen-stats").innerHTML = [
      { label: "Reports filed", value: reports.length, icon: "clipboard-list", tone: "var(--accent)", foot: "Every report you've sent", filter: "all" },
      { label: "In progress", value: open, icon: "construction", tone: "var(--info)", foot: "Being reviewed or repaired", filter: "open" },
      { label: "Fixed", value: fixed, icon: "check-circle", tone: "var(--success)", foot: "Repairs verified by the office", filter: "resolved" },
      { label: "Closed", value: closed, icon: "ban", tone: "var(--st-duplicate)", foot: "Rejected or duplicate reports", filter: "closed" },
    ]
      .map(function (item) {
        return (
          '<button class="card kpi" type="button" data-kpi-filter="' +
          item.filter +
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
    $$('[data-count="mine"]').forEach(function (element) {
      element.textContent = reports.length || (element.classList.contains("nav-badge") ? "" : "0");
    });
  }

  /* ---------- Views ---------- */

  // Every page of the portal lives here, so the sidebar never goes away.
  // Addresses: #report, #reports, #track (or #track/RPT-1048), #map, #public.
  const viewDetails = {
    report: { crumb: "Report a problem", title: "Report a problem" },
    reports: { crumb: "My reports", title: "My reports" },
    track: { crumb: "Track a report", title: "Track a report" },
    map: { crumb: "Live map", title: "Live map" },
    public: { crumb: "Public site", title: "Public site" },
  };

  function parseHash(hash) {
    const parts = String(hash || "").replace(/^#/, "").split("/");
    const name = Object.prototype.hasOwnProperty.call(viewDetails, parts[0]) ? parts[0] : "report";
    let id = "";
    if (name === "track" && parts[1]) {
      try {
        id = publicView.normalizeId(decodeURIComponent(parts[1]));
      } catch (error) {
        id = "";
      }
    }
    return { name: name, id: id };
  }

  function hashFor(name, id) {
    return "#" + name + (name === "track" && id ? "/" + encodeURIComponent(id) : "");
  }

  // Shows one page of the portal. `push` adds a browser history entry (for
  // clicks), so Back and Forward move between the portal's pages.
  function showView(name, options) {
    const settings = options || {};
    const view = Object.prototype.hasOwnProperty.call(viewDetails, name) ? name : "report";
    currentView = view;
    if (view === "track") {
      trackId = settings.id || "";
    }
    $$(".nav-item[data-portal-tab]").forEach(function (link) {
      const active = link.dataset.portalTab === view;
      link.classList.toggle("is-active", active);
      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    $$("[data-portal-panel]").forEach(function (panel) {
      const active = panel.dataset.portalPanel === view;
      if (active && panel.hidden) {
        panel.hidden = false;
        panel.style.animation = "none";
        panel.getBoundingClientRect();
        panel.style.animation = "";
      } else if (!active) {
        panel.hidden = true;
      }
    });
    $("#crumb-current").textContent = viewDetails[view].crumb;
    document.title = (view === "track" && trackId ? trackId + " · " : "") + viewDetails[view].title + " | ResQRoad";
    const hash = hashFor(view, view === "track" ? trackId : "");
    if (window.location.hash !== hash) {
      if (settings.push) {
        history.pushState(null, "", hash);
      } else {
        history.replaceState(null, "", hash);
      }
    }
    if (view === "report" && picker) {
      window.setTimeout(function () {
        picker.map.invalidateSize();
      }, 50);
    }
    if (state) {
      renderTrack();
      renderLiveMap();
      renderPublic();
    }
  }

  // Opens a report from a map or list: the resident's own reports open their
  // full details; anyone else's open in the tracker, as the public sees it.
  function openReport(reportId, opener) {
    const report = store.getReport(reportId);
    if (report && citizen && report.reporterId === citizen.id) {
      openDetails(report.id, opener);
    } else {
      showView("track", { push: true, id: publicView.normalizeId(reportId) });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  /* ---------- Location picker ---------- */

  function selectedSeverity() {
    const checked = form.querySelector('input[name="severity"]:checked');
    return checked ? checked.value : "";
  }

  function inBulacan(lat, lng) {
    return lat >= bulacan.south && lat <= bulacan.north && lng >= bulacan.west && lng <= bulacan.east;
  }

  function setPickerStatus(text, isSet) {
    const status = $("#picker-status");
    status.classList.toggle("is-set", Boolean(isSet));
    status.innerHTML = icon(isSet ? "check-circle" : "map-pin") + esc(text);
  }

  function setLocation(lat, lng, options) {
    const latitude = Math.round(Number(lat) * 1e6) / 1e6;
    const longitude = Math.round(Number(lng) * 1e6) / 1e6;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }
    if (!options || !options.fromInputs) {
      latInput.value = latitude.toFixed(6);
      lngInput.value = longitude.toFixed(6);
    }
    clearFieldError(latInput);
    clearFieldError(lngInput);
    if (picker) {
      const L = window.L;
      if (!picker.marker) {
        picker.marker = L.marker([latitude, longitude], {
          draggable: true,
          icon: ui.pinIcon(selectedSeverity() || "Medium", true),
          keyboard: false,
        }).addTo(picker.map);
        picker.marker.on("dragend", function () {
          const position = picker.marker.getLatLng();
          setLocation(position.lat, position.lng);
        });
      } else {
        picker.marker.setLatLng([latitude, longitude]);
      }
      if (options && options.pan) {
        picker.map.setView([latitude, longitude], Math.max(picker.map.getZoom(), 16));
      }
    }
    if (inBulacan(latitude, longitude)) {
      setPickerStatus("Pinned at " + latitude.toFixed(5) + ", " + longitude.toFixed(5) + " · drag the pin to adjust", true);
    } else {
      setPickerStatus("This spot is outside Bulacan. Move the pin to the damaged road.", false);
    }
    updateProgress();
  }

  function initPicker() {
    const host = $("#picker-map");
    let map = null;
    try {
      map = ui.createBaseMap(host);
    } catch (error) {
      console.error("Could not start the location picker map.", error);
    }
    if (!map) {
      host.innerHTML =
        '<div class="map-empty-overlay"><span>The map could not load. Enter the coordinates below instead.</span></div>';
      return;
    }
    map.setView(ui.mapCenter, 12);
    const L = window.L;
    // Existing open reports, so residents can see what's already been reported.
    // They're grey so they don't read as a severity color.
    state.reports
      .filter(function (report) {
        return store.openStatuses.includes(report.status) && report.coordinates;
      })
      .forEach(function (report) {
        L.circleMarker([report.coordinates.lat, report.coordinates.lng], {
          radius: 6,
          color: "#fff",
          weight: 2,
          fillColor: "#7c7c7c",
          fillOpacity: 0.9,
        })
          .bindTooltip("Already reported: " + report.title, { direction: "top", offset: [0, -6] })
          .addTo(map);
      });
    map.on("click", function (event) {
      setLocation(event.latlng.lat, event.latlng.lng);
    });
    picker = { map: map, marker: null };
  }

  function coordinatesFromInputs() {
    const lat = Number(latInput.value.trim());
    const lng = Number(lngInput.value.trim());
    if (latInput.value.trim() && lngInput.value.trim() && Number.isFinite(lat) && Number.isFinite(lng)) {
      setLocation(lat, lng, { pan: true, fromInputs: true });
    }
  }

  /* ---------- Photos ---------- */

  function renderThumbs() {
    $("#evidence-preview").innerHTML = photos
      .map(function (photo, index) {
        return (
          '<li class="thumb"><img src="' +
          esc(photo.src) +
          '" alt="" /><span>' +
          esc(photo.name) +
          '</span><button class="thumb-remove" type="button" data-remove-photo="' +
          index +
          '" aria-label="Remove ' +
          esc(photo.name) +
          '">' +
          icon("x") +
          "</button></li>"
        );
      })
      .join("");
    updateProgress();
  }

  function addFiles(files) {
    const room = maxPhotos - photos.length;
    if (room <= 0) {
      ui.showMessage("You can add up to " + maxPhotos + " photos.", "error");
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
    ).then(function (results) {
      results.filter(Boolean).forEach(function (photo) {
        photos.push(photo);
      });
      renderThumbs();
    });
  }

  /* ---------- Validation ---------- */

  function clearFieldError(input) {
    input.removeAttribute("aria-invalid");
    const label = input.closest(".field");
    const error = label && label.querySelector(":scope > .field-error");
    if (error) {
      error.remove();
    }
  }

  function setFieldError(input, message) {
    input.setAttribute("aria-invalid", "true");
    const label = input.closest(".field");
    if (!label) {
      return;
    }
    let error = label.querySelector(":scope > .field-error");
    if (!error) {
      error = document.createElement("span");
      error.className = "field-error";
      label.appendChild(error);
    }
    error.innerHTML = icon("alert-circle", "icon-sm") + esc(message);
  }

  function validate() {
    const problems = [];
    const title = form.elements.namedItem("title");
    const description = form.elements.namedItem("description");
    const road = form.elements.namedItem("road");
    const location = form.elements.namedItem("location");
    form.querySelectorAll("[aria-invalid]").forEach(clearFieldError);

    if (title.value.trim().length < 5) {
      problems.push([title, "Add a short title (at least 5 characters)."]);
    }
    if (!selectedSeverity()) {
      problems.push([form.querySelector('input[name="severity"]'), "Choose how severe the damage is."]);
    }
    if (description.value.trim().length < 10) {
      problems.push([description, "Describe the damage in a sentence or two."]);
    }
    const lat = Number(latInput.value);
    const lng = Number(lngInput.value);
    if (!latInput.value.trim() || !lngInput.value.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      problems.push([latInput, "Drop a pin on the map or enter the coordinates."]);
    } else if (!inBulacan(lat, lng)) {
      problems.push([latInput, "The location must be in Bulacan."]);
    }
    if (!road.value.trim()) {
      problems.push([road, "Enter the road or street name."]);
    }
    if (!location.value.trim()) {
      problems.push([location, "Enter the barangay and municipality."]);
    }

    problems.forEach(function (problem) {
      if (problem[0].name === "severity") {
        const fieldset = problem[0].closest("fieldset");
        let error = fieldset.querySelector(".field-error");
        if (!error) {
          error = document.createElement("span");
          error.className = "field-error";
          fieldset.appendChild(error);
        }
        error.innerHTML = icon("alert-circle", "icon-sm") + esc(problem[1]);
      } else {
        setFieldError(problem[0], problem[1]);
      }
    });
    return problems;
  }

  // Each form section's number turns into a check mark once it's complete.
  function updateProgress() {
    const title = form.elements.namedItem("title").value.trim();
    const description = form.elements.namedItem("description").value.trim();
    const done = {
      details: title.length >= 5 && Boolean(selectedSeverity()) && description.length >= 10,
      location:
        Boolean(latInput.value.trim() && lngInput.value.trim()) &&
        inBulacan(Number(latInput.value), Number(lngInput.value)) &&
        Boolean(form.elements.namedItem("road").value.trim()) &&
        Boolean(form.elements.namedItem("location").value.trim()),
      photos: photos.length > 0,
    };
    Object.keys(done).forEach(function (key, index) {
      const section = form.querySelector('[data-section="' + key + '"]');
      const badge = section.querySelector(".form-step-badge");
      section.classList.toggle("is-done", done[key]);
      badge.innerHTML = done[key] ? icon("check", "icon-sm") : String(index + 1);
    });
  }

  function resetForm() {
    form.reset();
    photos = [];
    renderThumbs();
    form.querySelectorAll("[aria-invalid]").forEach(clearFieldError);
    form.querySelectorAll(".field-error").forEach(function (error) {
      error.remove();
    });
    errorBox.hidden = true;
    $("[data-char-count]").textContent = "0 / 600";
    if (picker && picker.marker) {
      picker.marker.remove();
      picker.marker = null;
      picker.map.setView(ui.mapCenter, 12);
    }
    setPickerStatus("No location selected yet", false);
    updateProgress();
  }

  function showSuccess(report) {
    $("#report-layout").hidden = true;
    const success = $("#report-success");
    success.hidden = false;
    success.innerHTML =
      '<div class="success-mark">' +
      icon("check") +
      '</div><p class="eyebrow">Report submitted</p><h2>Thanks, ' +
      esc(citizen.name.split(" ")[0]) +
      ". We've got it.</h2><p class=\"muted\">The Road Maintenance Office will review your report. Save your report ID to follow its progress.</p>" +
      '<div class="report-id">' +
      icon("hash") +
      esc(report.id) +
      '</div><div class="journey-card">' +
      ui.journey(report) +
      '</div><div class="success-actions"><a class="btn btn-primary" href="' +
      esc(hashFor("track", report.id)) +
      '" data-portal-tab="track">' +
      icon("search", "icon-sm") +
      'Track this report</a><button class="btn btn-secondary" type="button" data-show-reports>' +
      icon("clipboard-list", "icon-sm") +
      'View my reports</button><button class="btn btn-ghost" type="button" data-report-another>' +
      icon("plus", "icon-sm") +
      "Report another problem</button></div>";
    success.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- My reports ---------- */

  function renderMyReports() {
    const query = $("#my-search").value.trim().toLowerCase();
    const all = myReports();
    const reports = all.filter(function (report) {
      if (myFilter === "open" && !store.openStatuses.includes(report.status)) {
        return false;
      }
      if (myFilter === "resolved" && report.status !== "resolved") {
        return false;
      }
      if (myFilter === "closed" && !["rejected", "duplicate"].includes(report.status)) {
        return false;
      }
      return !query || [report.id, report.title, report.road, report.location].join(" ").toLowerCase().includes(query);
    });

    if (reports.length === 0) {
      $("#my-reports").innerHTML =
        '<div class="card empty"><span class="empty-icon">' +
        icon(all.length ? "search" : "map-pin") +
        "</span><h3>" +
        (all.length ? "No reports match" : "You haven't reported anything yet") +
        "</h3><p>" +
        (all.length
          ? "Try a different search or filter."
          : "Spotted a pothole or damaged road? Report it and follow the repair here.") +
        "</p>" +
        (all.length ? "" : '<button class="btn btn-primary" type="button" data-start-report style="margin-top: 1rem">' + icon("map-pin", "icon-sm") + "Report a problem</button>") +
        "</div>";
      return;
    }

    $("#my-reports").innerHTML = reports
      .map(function (report, index) {
        const photo = ui.reportPhotos(report)[0];
        const latest = (report.history || []).filter(function (entry) {
          return entry.status !== "note";
        }).slice(-1)[0];
        // Once a repair is verified, residents see the crew's notes and their
        // photos of the finished repair.
        const repairNotes = report.status === "resolved" && report.repair ? repairResult(report) : "";
        return (
          '<article class="card my-report" style="--i:' +
          Math.min(index, 10) +
          '"><div class="my-report-head"><div class="my-report-thumb">' +
          ui.photoImg(photo) +
          '</div><div><span class="id-tag">' +
          esc(report.id) +
          " · " +
          esc(ui.formatDay(report.reportedAt)) +
          "</span><h3>" +
          esc(report.title) +
          '</h3><p class="job-meta" style="margin: 0"><span>' +
          icon("map-pin") +
          esc(report.road + " · " + report.location) +
          "</span>" +
          ui.severityBadge(report.severity) +
          '</p></div><div class="my-report-side">' +
          ui.statusPill(report.status) +
          '<button class="btn btn-secondary btn-sm" type="button" data-open-report="' +
          esc(report.id) +
          '">' +
          icon("file-text", "icon-sm") +
          'View details<span class="visually-hidden"> of ' +
          esc(report.id) +
          '</span></button></div></div><div class="my-report-body"><p class="my-report-desc">' +
          esc(report.description) +
          '</p><div class="journey-card">' +
          ui.journey(report) +
          "</div>" +
          repairNotes +
          '</div><details><summary>Progress updates' +
          (latest ? " · last update " + esc(ui.relativeTime(latest.at)) : "") +
          icon("chevron-down", "icon-sm") +
          "</summary><div>" +
          ui.timeline(report, { publicOnly: true }) +
          '<p style="margin: 1rem 0 0"><a class="link-button" href="' +
          esc(hashFor("track", report.id)) +
          '" data-portal-tab="track">Track this report' +
          icon("arrow-right", "icon-sm") +
          "</a></p></div></details></article>"
        );
      })
      .join("");
  }

  // Quick picks under the search, like the tracker's "Recent" chips: reports
  // the resident looked up on the tracker first, then their newest reports.
  function readTracked() {
    try {
      const list = JSON.parse(localStorage.getItem(recentKey) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (error) {
      return [];
    }
  }

  function renderRecent() {
    const mine = myReports().map(function (report) {
      return report.id;
    });
    const picks = Array.from(
      new Set(
        readTracked()
          .filter(function (id) {
            return mine.includes(id);
          })
          .concat(mine),
      ),
    ).slice(0, 4);
    const query = $("#my-search").value.trim().toUpperCase();
    const box = $("#my-recent");
    box.hidden = picks.length === 0;
    box.innerHTML =
      "<span>Recent:</span>" +
      picks
        .map(function (id) {
          return '<button type="button" data-recent="' + esc(id) + '" aria-pressed="' + String(query === id) + '">' + esc(id) + "</button>";
        })
        .join("");
  }

  // The crew's notes and after-repair photos, once the office verified them.
  function repairResult(report) {
    const afterPhotos = ui.repairPhotos(report, "after");
    return (
      '<div class="callout"><p class="section-label">What the crew did</p>' +
      (report.repair.notes ? '<p class="detail-description">' + esc(report.repair.notes) + "</p>" : "") +
      (afterPhotos.length
        ? '<div class="repair-photos"><h4>After-repair photos <span>' +
          esc(ui.pluralize(afterPhotos.length, "photo")) +
          "</span></h4>" +
          ui.photoGallery(afterPhotos, "After-repair photos", "gallery-grid") +
          "</div>"
        : "") +
      "</div>"
    );
  }

  /* ---------- Track a report ---------- */

  function rememberTracked(reportId) {
    const list = [reportId]
      .concat(
        readTracked().filter(function (id) {
          return typeof id === "string" && id !== reportId;
        }),
      )
      .slice(0, 5);
    try {
      localStorage.setItem(recentKey, JSON.stringify(list));
    } catch (error) {
      // Recent searches are only a convenience.
    }
  }

  function renderTrackRecent() {
    const list = readTracked().filter(function (id) {
      return typeof id === "string";
    });
    const box = $("#track-recent");
    box.hidden = list.length === 0;
    box.innerHTML =
      "<span>Recent:</span>" +
      list
        .map(function (id) {
          return '<button type="button" data-track-pick="' + esc(id) + '" aria-pressed="' + String(id === trackId) + '">' + esc(id) + "</button>";
        })
        .join("");
  }

  // The resident's own reports, to pick one to track.
  function trackPicker() {
    const reports = myReports();
    if (reports.length === 0) {
      return (
        '<div class="card empty"><span class="empty-icon">' +
        icon("search") +
        "</span><h3>Enter a report ID</h3><p>Report IDs look like RPT-1048. Reports you file appear here so you can follow them.</p>" +
        '<button class="btn btn-primary" type="button" data-start-report style="margin-top: 1rem">' +
        icon("map-pin", "icon-sm") +
        "Report a problem</button></div>"
      );
    }
    return (
      '<section class="card" aria-labelledby="track-mine-title"><div class="card-header"><div><h2 class="card-title" id="track-mine-title">' +
      icon("clipboard-list") +
      'Your reports</h2><p class="card-subtitle">Select a report to see where it is in the repair process.</p></div></div><div class="card-body"><ul class="track-picks">' +
      reports
        .map(function (report) {
          return (
            '<li><button class="track-pick" type="button" data-track-pick="' +
            esc(report.id) +
            '"><span class="track-pick-copy"><span class="id-tag">' +
            esc(report.id + " · " + ui.formatDay(report.reportedAt)) +
            "</span><strong>" +
            esc(report.title) +
            "</strong><span>" +
            esc(report.road + " · " + report.location) +
            '</span></span><span class="track-pick-tags">' +
            ui.severityBadge(report.severity) +
            ui.statusPill(report.status) +
            "</span>" +
            icon("chevron-right", "icon-sm") +
            "</button></li>"
          );
        })
        .join("") +
      "</ul></div></section>"
    );
  }

  function renderTrack() {
    if (currentView !== "track") {
      return;
    }
    const input = $("#portal-track-input");
    if (document.activeElement !== input) {
      input.value = trackId;
    }
    if (trackMap) {
      trackMap.destroy();
      trackMap = null;
    }
    const box = $("#portal-track-result");
    if (!trackId) {
      renderTrackRecent();
      box.innerHTML = trackPicker();
      return;
    }
    const report = store.getReport(trackId);
    if (!report) {
      renderTrackRecent();
      box.innerHTML =
        '<div class="card empty"><span class="empty-icon">' +
        icon("alert-circle") +
        "</span><h3>We couldn't find " +
        esc(trackId) +
        "</h3><p>Check the ID and try again. Report IDs look like RPT-1048.</p></div>" +
        (myReports().length ? '<div style="margin-top: 1.25rem">' + trackPicker() + "</div>" : "");
      return;
    }
    rememberTracked(report.id);
    renderTrackRecent();
    const mine = report.reporterId === citizen.id;
    box.innerHTML = publicView.trackCard(report, {
      headActions:
        '<div class="toolbar-group">' +
        (mine
          ? '<button class="btn btn-primary btn-sm" type="button" data-open-report="' +
            esc(report.id) +
            '">' +
            icon("file-text", "icon-sm") +
            "View details</button>"
          : "") +
        '<button class="btn btn-secondary btn-sm" type="button" data-copy-track="' +
        esc(report.id) +
        '">' +
        icon("copy", "icon-sm") +
        "Copy link</button></div>",
    });
    trackMap = ui.renderMap(box.querySelector("[data-track-map]"), [report], {
      popup: false,
      zoom: 15,
      emptyMessage: "Location unavailable.",
    });
  }

  function copyTrackingLink(reportId) {
    const link = new URL("track.html?id=" + encodeURIComponent(reportId), window.location.href).href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(
        function () {
          ui.showMessage("Tracking link for " + reportId + " copied.", "success");
        },
        function () {
          ui.showMessage(link, "info");
        },
      );
    } else {
      ui.showMessage(link, "info");
    }
  }

  /* ---------- Live map ---------- */

  // The public map (verified reports through to fixed) plus every report the
  // resident filed that is still open or fixed.
  function onLiveMap(report) {
    const mine = report.reporterId === citizen.id;
    return publicView.publicStatuses.includes(report.status) || (mine && !["rejected", "duplicate"].includes(report.status));
  }

  function liveMapReports() {
    const scope = $("#live-map-scope").value;
    return state.reports
      .filter(function (report) {
        if (!onLiveMap(report)) {
          return false;
        }
        if (scope === "mine" && report.reporterId !== citizen.id) {
          return false;
        }
        if (scope === "open" && !store.openStatuses.includes(report.status)) {
          return false;
        }
        if (scope === "fixed" && report.status !== "resolved") {
          return false;
        }
        return liveSeverity === "all" || report.severity === liveSeverity;
      })
      .sort(function (first, second) {
        return severityRank[second.severity] - severityRank[first.severity] || Date.parse(second.reportedAt) - Date.parse(first.reportedAt);
      });
  }

  function renderLiveMap() {
    if (currentView !== "map") {
      return;
    }
    const all = state.reports.filter(onLiveMap);
    const count = function (test) {
      return all.filter(test).length;
    };
    $("#live-map-stats").innerHTML = [
      { label: "Reports on the map", value: all.length, icon: "map", tone: "var(--accent)" },
      {
        label: "Being repaired",
        value: count(function (report) {
          return ["assigned", "in_progress", "repair_submitted"].includes(report.status);
        }),
        icon: "construction",
        tone: "var(--info)",
      },
      {
        label: "Fixed roads",
        value: count(function (report) {
          return report.status === "resolved";
        }),
        icon: "check-circle",
        tone: "var(--success)",
      },
      {
        label: "Your open reports",
        value: count(function (report) {
          return report.reporterId === citizen.id && store.openStatuses.includes(report.status);
        }),
        icon: "clipboard-list",
        tone: "var(--st-assigned)",
      },
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

    const reports = liveMapReports();
    liveMap = ui.renderMap($("#live-map"), reports, {
      emptyMessage: "No reports match these filters.",
      popup: function (report) {
        return ui.reportPopup(report, {
          action: "open",
          actionLabel: report.reporterId === citizen.id ? "View details" : "Track this report",
        });
      },
      onAction: function (action, reportId, button) {
        openReport(reportId, button);
      },
      onSelect: highlightLiveItem,
      pulse: function (report) {
        return report.severity === "High" && store.openStatuses.includes(report.status);
      },
    });
    $("#live-map-legend").innerHTML =
      ui.mapLegend() + '<p class="field-hint" style="margin-top: 0.35rem">Select a pin to see the report. Your own reports open with full details.</p>';
    $("#live-map-count").textContent = ui.pluralize(reports.length, "report") + " shown";
    $("#live-map-list").innerHTML = reports.length
      ? reports
          .map(function (report) {
            const mine = report.reporterId === citizen.id;
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
              (mine ? '<span class="map-list-tag">Yours</span>' : "") +
              "</small></button></li>"
            );
          })
          .join("")
      : '<li class="empty"><p>No reports match these filters.</p></li>';
  }

  function highlightLiveItem(reportId) {
    $$("#live-map-list .map-list-item").forEach(function (item) {
      const active = item.dataset.mapFocus === reportId;
      item.classList.toggle("is-active", active);
      if (active) {
        item.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }

  /* ---------- Public site ---------- */

  function renderPublic() {
    if (currentView !== "public") {
      return;
    }
    publicView.render($("#public-view"), state, {
      openLabel: "View report",
      onOpen: openReport,
    });
  }

  /* ---------- Report details ---------- */

  // Everything about one of the resident's own reports. The server never
  // sends internal notes or staff-only details to residents.
  function renderDetails(reportId) {
    const report = myReports().find(function (item) {
      return item.id === reportId;
    });
    if (!report) {
      throw new Error("This report is no longer available.");
    }
    const sameReport = drawer.body.dataset.reportId === reportId;
    const scroll = sameReport ? drawer.body.scrollTop : 0;
    if (detailMap) {
      detailMap.destroy();
      detailMap = null;
    }
    // Only the photos sent with the report; a report filed without photos
    // says so instead of showing stand-in pictures. (Sample reports list file
    // names only, so they keep the same sample photos as everywhere else.)
    const listed = report.evidencePhotos || [];
    const photos = ui.photosWithData(listed).length || listed.length ? ui.reportPhotos(report) : [];
    drawer.meta.innerHTML = '<span class="drawer-report-id">' + esc(report.id) + "</span>";
    drawer.body.innerHTML =
      '<h2 class="detail-title" id="drawer-title">' +
      esc(report.title) +
      '</h2><p class="detail-sub"><span>' +
      icon("map-pin") +
      esc(report.road + " · " + report.location) +
      "</span><span>" +
      icon("calendar") +
      esc("Reported " + ui.relativeTime(report.reportedAt)) +
      '</span></p><p class="alert alert-brand">' +
      icon("info") +
      "<span>" +
      esc(publicView.plainStatus[report.status] || "Status updated.") +
      '</span></p><div class="journey-card">' +
      ui.journey(report) +
      '</div><section class="detail-block"><div class="detail-block-head"><h3>' +
      icon("camera") +
      "Road damage photos</h3>" +
      (photos.length
        ? '<span class="muted text-sm">' +
          ui.pluralize(photos.length, "photo") +
          " · select to enlarge</span></div>" +
          ui.photoGallery(photos, "Road damage photos")
        : '</div><p class="muted text-sm" style="margin: 0">You didn\'t add photos to this report.</p>') +
      '</section><section class="detail-block detail-columns"><div class="detail-column"><div class="detail-block-head"><h3>' +
      icon("info") +
      'Information</h3></div><dl class="facts"><div><dt>Severity</dt><dd>' +
      ui.severityBadge(report.severity) +
      "</dd></div><div><dt>Status</dt><dd>" +
      ui.statusPill(report.status) +
      "</dd></div><div><dt>Reported on</dt><dd>" +
      esc(ui.formatDate(report.reportedAt)) +
      "</dd></div><div><dt>Last update</dt><dd>" +
      esc(ui.relativeTime(publicView.lastUpdate(report))) +
      '</dd></div><div class="facts-wide"><dt>Road and place</dt><dd>' +
      esc(report.road + " · " + report.location) +
      '</dd></div><div class="facts-wide"><dt>GPS coordinates</dt><dd class="mono">' +
      esc(report.coordinates.lat + ", " + report.coordinates.lng) +
      ' · <a href="' +
      esc(ui.osmUrl(report.coordinates)) +
      '" target="_blank" rel="noreferrer">Open in OpenStreetMap</a></dd></div></dl></div><div class="detail-column"><div class="detail-block-head"><h3>' +
      icon("map") +
      'Map</h3></div><div class="detail-map"><div class="map" id="detail-map"></div></div></div></section>' +
      '<section class="detail-block"><div class="detail-block-head"><h3>' +
      icon("file-text") +
      'Description</h3></div><p class="detail-description">' +
      esc(report.description) +
      "</p></section>" +
      (report.status === "resolved" && report.repair
        ? '<section class="detail-block"><div class="detail-block-head"><h3>' +
          icon("wrench") +
          "Repair result</h3>" +
          (report.repair.submittedAt
            ? '<span class="muted text-sm">' + esc("Repaired " + ui.formatDay(report.repair.submittedAt)) + "</span>"
            : "") +
          "</div>" +
          repairResult(report) +
          "</section>"
        : "") +
      '<section class="detail-block"><div class="detail-block-head"><h3>' +
      icon("activity") +
      "Progress updates</h3></div>" +
      ui.timeline(report, { publicOnly: true }) +
      "</section>";
    drawer.actions.innerHTML =
      '<p class="footer-note">Only you and the Road Maintenance Office can see that you filed this report.</p>' +
      '<a class="btn btn-secondary" href="' +
      esc(hashFor("track", report.id)) +
      '" data-portal-tab="track">' +
      icon("search", "icon-sm") +
      "Track this report</a>";
    detailMap = ui.renderMap(drawer.body.querySelector("#detail-map"), [report], {
      popup: false,
      zoom: 15,
      emptyMessage: "Location coordinates are unavailable.",
    });
    drawer.body.dataset.reportId = reportId;
    drawer.body.scrollTop = scroll;
  }

  function openDetails(reportId, opener) {
    try {
      renderDetails(reportId);
    } catch (error) {
      ui.showMessage(error.message, "error");
      return;
    }
    openReportId = reportId;
    if (drawer.panel.classList.contains("is-open")) {
      return;
    }
    drawerOpener = opener || document.activeElement;
    drawer.panel.classList.add("is-open");
    drawer.scrim.classList.add("is-open");
    drawer.panel.setAttribute("aria-hidden", "false");
    restoreDrawerInert = ui.setBackgroundInert([drawer.panel, drawer.scrim]);
    document.documentElement.style.overflow = "hidden";
    drawer.body.scrollTop = 0;
    drawer.close.focus({ preventScroll: true });
    window.setTimeout(function () {
      if (detailMap) {
        detailMap.refresh();
      }
    }, 380);
  }

  function closeDetails(restoreFocus) {
    if (!drawer.panel.classList.contains("is-open")) {
      return;
    }
    drawer.panel.classList.remove("is-open");
    drawer.scrim.classList.remove("is-open");
    drawer.panel.setAttribute("aria-hidden", "true");
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

  function rememberStatuses() {
    knownStatuses = new Map(
      myReports().map(function (report) {
        return [report.id, report.status];
      }),
    );
  }

  function render() {
    loadState();
    renderHeader();
    renderMyReports();
    renderRecent();
    renderTrack();
    renderLiveMap();
    renderPublic();
    if (openReportId && drawer.panel.classList.contains("is-open")) {
      try {
        renderDetails(openReportId);
      } catch (error) {
        closeDetails(false);
      }
    }
  }

  /* ---------- Events ---------- */

  // Links and buttons to the portal's pages (sidebar, account menu, and
  // buttons in the pages) switch pages in place.
  document.addEventListener("click", function (event) {
    const link = event.target.closest("[data-portal-tab]");
    // Ctrl/Cmd/Shift-click still opens the page in a new tab or window.
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    const target = parseHash(link.getAttribute("href") || link.dataset.portalTab);
    closeDetails(false);
    showView(target.name, { push: true, id: target.id });
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  // Back and Forward, and addresses typed or linked with a #page.
  window.addEventListener("hashchange", function () {
    const target = parseHash(window.location.hash);
    closeDetails(false);
    showView(target.name, { id: target.id });
  });

  document.addEventListener("click", function (event) {
    if (event.target.closest("[data-show-reports]")) {
      showView("reports", { push: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (event.target.closest("[data-report-another]") || event.target.closest("[data-start-report]")) {
      $("#report-success").hidden = true;
      $("#report-layout").hidden = false;
      showView("report", { push: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(function () {
        form.elements.namedItem("title").focus({ preventScroll: true });
      }, 300);
    } else if (event.target.closest("[data-open-report]")) {
      const button = event.target.closest("[data-open-report]");
      openDetails(button.dataset.openReport, button);
    } else if (event.target.closest("[data-track-pick]")) {
      showView("track", { push: true, id: event.target.closest("[data-track-pick]").dataset.trackPick });
    } else if (event.target.closest("[data-copy-track]")) {
      copyTrackingLink(event.target.closest("[data-copy-track]").dataset.copyTrack);
    }
  });

  $("#portal-track-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const id = publicView.normalizeId($("#portal-track-input").value);
    showView("track", { push: id !== trackId, id: id });
  });

  $("#portal-track-result").addEventListener("click", function (event) {
    const photo = event.target.closest("[data-gallery-index]");
    if (photo) {
      const images = Array.from(photo.closest("[data-gallery-group]").querySelectorAll("img")).map(function (image) {
        return { src: image.currentSrc || image.src, alt: image.alt };
      });
      ui.openLightbox(images, Number(photo.dataset.galleryIndex), photo);
    }
  });

  $("#live-map-severity").addEventListener("click", function (event) {
    const chip = event.target.closest("[data-severity]");
    if (!chip) {
      return;
    }
    liveSeverity = chip.dataset.severity;
    $$("#live-map-severity [data-severity]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button === chip));
    });
    renderLiveMap();
  });
  $("#live-map-scope").addEventListener("change", renderLiveMap);
  $("#live-map-list").addEventListener("click", function (event) {
    const item = event.target.closest("[data-map-focus]");
    if (item && liveMap) {
      highlightLiveItem(item.dataset.mapFocus);
      liveMap.focus(item.dataset.mapFocus);
    }
  });

  // Report details panel.
  drawer.body.addEventListener("click", function (event) {
    const photo = event.target.closest("[data-gallery-index]");
    if (photo) {
      const images = Array.from(photo.closest("[data-gallery-group]").querySelectorAll("img")).map(function (image) {
        return { src: image.currentSrc || image.src, alt: image.alt };
      });
      ui.openLightbox(images, Number(photo.dataset.galleryIndex), photo);
    }
  });
  drawer.close.addEventListener("click", function () {
    closeDetails();
  });
  drawer.scrim.addEventListener("click", function () {
    closeDetails();
  });
  $("#drawer-copy").addEventListener("click", function () {
    if (openReportId) {
      copyTrackingLink(openReportId);
    }
  });
  // Dialogs, menus, and the lightbox handle Escape themselves first.
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && drawer.panel.classList.contains("is-open")) {
      event.preventDefault();
      closeDetails();
    }
  });

  form.addEventListener("input", function (event) {
    if (event.target.getAttribute("aria-invalid")) {
      clearFieldError(event.target);
    }
    if (event.target.name === "description") {
      $("[data-char-count]").textContent = event.target.value.length + " / 600";
    }
    updateProgress();
  });

  form.addEventListener("change", function (event) {
    if (event.target.name === "severity") {
      const fieldsetError = event.target.closest("fieldset").querySelector(".field-error");
      if (fieldsetError) {
        fieldsetError.remove();
      }
      if (picker && picker.marker) {
        picker.marker.setIcon(ui.pinIcon(event.target.value, true));
      }
      updateProgress();
    }
    if (event.target.id === "evidence-input") {
      addFiles(Array.from(event.target.files || []));
      event.target.value = "";
    }
  });

  [latInput, lngInput].forEach(function (input) {
    input.addEventListener("change", coordinatesFromInputs);
  });

  $("#use-location").addEventListener("click", function () {
    const button = $("#use-location");
    if (!navigator.geolocation) {
      ui.showMessage("Your browser can't share your location. Drop a pin on the map instead.", "error");
      return;
    }
    button.classList.add("is-loading");
    navigator.geolocation.getCurrentPosition(
      function (position) {
        button.classList.remove("is-loading");
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (!inBulacan(lat, lng)) {
          ui.showMessage("You appear to be outside Bulacan. Drop the pin on the damaged road instead.", "info");
          return;
        }
        setLocation(lat, lng, { pan: true });
      },
      function () {
        button.classList.remove("is-loading");
        ui.showMessage("We couldn't get your location. Drop a pin on the map instead.", "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });

  $("#evidence-preview").addEventListener("click", function (event) {
    const remove = event.target.closest("[data-remove-photo]");
    if (remove) {
      photos.splice(Number(remove.dataset.removePhoto), 1);
      renderThumbs();
    }
  });

  const dropzone = form.querySelector(".dropzone");
  ["dragenter", "dragover"].forEach(function (type) {
    dropzone.addEventListener(type, function () {
      dropzone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach(function (type) {
    dropzone.addEventListener(type, function () {
      dropzone.classList.remove("is-dragging");
    });
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton.classList.contains("is-loading")) {
      return;
    }
    errorBox.hidden = true;
    const problems = validate();
    if (problems.length) {
      errorBox.innerHTML =
        icon("alert-circle") +
        "<span>" +
        esc(problems.length === 1 ? problems[0][1] : "Please fix the " + problems.length + " highlighted fields.") +
        "</span>";
      errorBox.hidden = false;
      const first = problems[0][0];
      first.focus({ preventScroll: true });
      first.closest(".form-section, .field").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    submitButton.classList.add("is-loading");
    try {
      const report = await store.addReport({
        reporterId: citizen.id,
        title: form.elements.namedItem("title").value,
        road: form.elements.namedItem("road").value,
        location: form.elements.namedItem("location").value,
        description: form.elements.namedItem("description").value,
        latitude: latInput.value,
        longitude: lngInput.value,
        severity: selectedSeverity(),
        evidencePhotos: photos,
      });
      submitButton.classList.remove("is-loading");
      if (report.photosTrimmed) {
        ui.showMessage("Your report was saved, but the photos couldn't be uploaded.", "info");
      }
      resetForm();
      render();
      rememberStatuses();
      showSuccess(report);
    } catch (error) {
      console.error("Could not submit the report.", error);
      submitButton.classList.remove("is-loading");
      errorBox.innerHTML =
        icon("alert-circle") +
        "<span>" +
        esc(error.message) +
        (error.duplicateId
          ? ' <a href="' + esc(hashFor("track", error.duplicateId)) + '" data-portal-tab="track">Follow ' + esc(error.duplicateId) + " instead</a>."
          : "") +
        "</span>";
      errorBox.hidden = false;
      errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  function setFilter(filter) {
    myFilter = filter;
    $$("#my-filter [data-filter]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
    });
    renderMyReports();
  }

  $("#my-search").addEventListener(
    "input",
    ui.debounce(function () {
      renderMyReports();
      renderRecent();
    }, 120),
  );
  $("#my-recent").addEventListener("click", function (event) {
    const chip = event.target.closest("[data-recent]");
    if (!chip) {
      return;
    }
    // A second click on the active chip clears the search again.
    $("#my-search").value = chip.getAttribute("aria-pressed") === "true" ? "" : chip.dataset.recent;
    renderMyReports();
    renderRecent();
  });
  $("#my-filter").addEventListener("click", function (event) {
    const chip = event.target.closest("[data-filter]");
    if (chip) {
      setFilter(chip.dataset.filter);
    }
  });
  $("#citizen-stats").addEventListener("click", function (event) {
    const tile = event.target.closest("[data-kpi-filter]");
    if (tile) {
      setFilter(tile.dataset.kpiFilter);
    }
  });
  $("#my-reports").addEventListener("click", function (event) {
    const photo = event.target.closest("[data-gallery-index]");
    if (photo) {
      const images = Array.from(photo.closest("[data-gallery-group]").querySelectorAll("img")).map(function (image) {
        return { src: image.currentSrc || image.src, alt: image.alt };
      });
      ui.openLightbox(images, Number(photo.dataset.galleryIndex), photo);
    }
  });

  // Staff updates from other tabs: refresh and say what changed.
  store.onExternalChange(function () {
    try {
      render();
      myReports().forEach(function (report) {
        const before = knownStatuses.get(report.id);
        if (before && before !== report.status) {
          ui.showMessage(report.id + " is now " + ui.statusLabel(report.status) + ".", report.status === "rejected" ? "info" : "success");
        }
      });
      rememberStatuses();
    } catch (error) {
      console.error("Could not refresh ResQRoad data.", error);
    }
  });

  /* ---------- Start ---------- */

  try {
    render();
    rememberStatuses();
    const roads = new Set();
    const places = new Set();
    state.reports.forEach(function (report) {
      roads.add(report.road);
      places.add(report.location);
    });
    $("#road-suggestions").innerHTML = Array.from(roads)
      .sort()
      .map(function (road) {
        return '<option value="' + esc(road) + '"></option>';
      })
      .join("");
    $("#place-suggestions").innerHTML = Array.from(places)
      .sort()
      .map(function (place) {
        return '<option value="' + esc(place) + '"></option>';
      })
      .join("");
    initPicker();
    const initial = parseHash(window.location.hash);
    showView(initial.name, { id: initial.id });
    updateProgress();
  } catch (error) {
    console.error("Could not load the citizen portal.", error);
    ui.showMessage(error.message, "error");
  }
})();
