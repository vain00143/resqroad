/* Citizen portal: report road damage (with a map pin and photos) and follow
   the reports you've filed. Status changes made by staff in other tabs show
   up live, with a notification. */
(async function () {
  "use strict";

  const store = window.RoadWatchStore;
  const ui = window.RoadWatchUI;
  const icon = ui.icon;
  const esc = ui.escapeHtml;
  const currentUser = await window.RoadWatchAuth.requireRole("citizen", "login.html");
  if (!currentUser) {
    return;
  }

  const maxPhotos = 5;
  const recentKey = "resqroad-recent-tracks";
  const bulacan = { south: 14.5, north: 15.2, west: 120.3, east: 121.2 };
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
  let state = null;
  let citizen = null;
  let photos = [];
  let picker = null;
  let myFilter = "all";
  let knownStatuses = new Map();

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

  const viewDetails = {
    report: { crumb: "Report a problem", title: "Report a problem" },
    reports: { crumb: "My reports", title: "My reports" },
  };

  function setTab(name) {
    const tab = name === "reports" ? "reports" : "report";
    $$(".nav-item[data-portal-tab]").forEach(function (link) {
      const active = link.dataset.portalTab === tab;
      link.classList.toggle("is-active", active);
      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    $$("[data-portal-panel]").forEach(function (panel) {
      const active = panel.dataset.portalPanel === tab;
      if (active && panel.hidden) {
        panel.hidden = false;
        panel.style.animation = "none";
        panel.getBoundingClientRect();
        panel.style.animation = "";
      } else if (!active) {
        panel.hidden = true;
      }
    });
    $("#crumb-current").textContent = viewDetails[tab].crumb;
    document.title = viewDetails[tab].title + " | ResQRoad";
    if (window.location.hash !== "#" + tab) {
      history.replaceState(null, "", "#" + tab);
    }
    if (tab === "report" && picker) {
      window.setTimeout(function () {
        picker.map.invalidateSize();
      }, 50);
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
      '</div><div class="success-actions"><a class="btn btn-primary" href="track.html?id=' +
      encodeURIComponent(report.id) +
      '">' +
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
        // Once a repair is verified, residents see the crew's notes and photos.
        const repairNotes =
          report.status === "resolved" && report.repair
            ? '<div class="callout"><p class="section-label">What the crew did</p>' +
              (report.repair.notes ? '<p class="detail-description">' + esc(report.repair.notes) + "</p>" : "") +
              '<div class="before-after"><div><h4>Before</h4>' +
              ui.photoGallery(ui.repairPhotos(report, "before"), "Before repair photos") +
              "</div><div><h4>After</h4>" +
              ui.photoGallery(ui.repairPhotos(report, "after"), "After repair photos") +
              "</div></div></div>"
            : "";
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
          "</p></div>" +
          ui.statusPill(report.status) +
          '</div><div class="my-report-body"><div class="journey-card">' +
          ui.journey(report) +
          "</div>" +
          repairNotes +
          '</div><details><summary>Progress updates' +
          (latest ? " · last update " + esc(ui.relativeTime(latest.at)) : "") +
          icon("chevron-down", "icon-sm") +
          "</summary><div>" +
          ui.timeline(report, { publicOnly: true }) +
          '<p style="margin: 1rem 0 0"><a class="link-button" href="track.html?id=' +
          encodeURIComponent(report.id) +
          '">Open the public tracking page' +
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
  }

  /* ---------- Events ---------- */

  $$("[data-portal-tab]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      setTab(link.dataset.portalTab);
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  });
  window.addEventListener("hashchange", function () {
    setTab(window.location.hash.replace("#", ""));
  });

  document.addEventListener("click", function (event) {
    if (event.target.closest("[data-show-reports]")) {
      setTab("reports");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (event.target.closest("[data-report-another]") || event.target.closest("[data-start-report]")) {
      $("#report-success").hidden = true;
      $("#report-layout").hidden = false;
      setTab("report");
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(function () {
        form.elements.namedItem("title").focus({ preventScroll: true });
      }, 300);
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
          ? ' <a href="track.html?id=' + encodeURIComponent(error.duplicateId) + '">Follow ' + esc(error.duplicateId) + " instead</a>."
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
    setTab(window.location.hash.replace("#", "") || "report");
    updateProgress();
  } catch (error) {
    console.error("Could not load the citizen portal.", error);
    ui.showMessage(error.message, "error");
  }
})();
