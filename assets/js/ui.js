/* Shared ResQRoad UI helpers: formatting, status and severity tags, toasts,
   confirm/prompt dialogs, the photo lightbox and hover preview, report
   journeys and timelines, CSV export, image resizing, and maps. Maps use
   Leaflet with CARTO/OpenStreetMap tiles and fall back to a schematic map of
   Bulacan when the map library or its tiles cannot load. */
(function () {
  "use strict";

  const icon = window.RoadWatchIcons.svg;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const placeholderPhoto = "assets/images/photo-placeholder.svg";
  const sampleRepairPhotos = {
    before: "assets/images/sample-repair-before.svg",
    after: "assets/images/sample-repair-after.svg",
  };
  const sampleRoadPhotos = [
    {
      src: "https://npr.brightspotcdn.com/dims4/default/c139ad9/2147483647/strip/true/crop/1024x768%2B0%2B0/resize/880x660%21/quality/90/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2Flegacy%2Fsites%2Fwkar%2Ffiles%2Fpothole.jpg",
      alt: "Road with a pothole and cracked asphalt",
    },
    {
      src: "https://images.ndr.de/image/9c2f731c-b45c-47df-8ab2-d88be4e899ca/AAABnGEgSRY/AAABnSSvrFg/16x9-big/schlagloch-114.webp?width=1920",
      alt: "Close view of a damaged road surface",
    },
    {
      src: "https://media-cache.primedia-service.com/media/aafj0u44/kbhxwvhtyml5hkqmbubg.jpg?format=webp&height=576&rxy=0.3325231570081917%2C0.4276253139811917&v=1dc2ca685c648b0&width=1026",
      alt: "Road damage with several potholes",
    },
  ];
  const journeyStatuses = [
    "submitted",
    "under_review",
    "verified",
    "assigned",
    "in_progress",
    "repair_submitted",
    "resolved",
  ];

  function store() {
    return window.RoadWatchStore;
  }

  /* ---------- Formatting ---------- */

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function toDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = toDate(value);
    return date
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)
      : "Date unavailable";
  }

  function formatDay(value) {
    const date = toDate(value);
    return date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date) : "Date unavailable";
  }

  function formatShortDay(value) {
    const date = toDate(value);
    return date ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date) : "—";
  }

  const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  function relativeTime(value) {
    const date = toDate(value);
    if (!date) {
      return "Date unavailable";
    }
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const abs = Math.abs(seconds);
    if (abs < 45) {
      return "just now";
    }
    if (abs < 3600) {
      return relativeFormat.format(Math.round(seconds / 60), "minute");
    }
    if (abs < 86400) {
      return relativeFormat.format(Math.round(seconds / 3600), "hour");
    }
    if (abs < 86400 * 7) {
      return relativeFormat.format(Math.round(seconds / 86400), "day");
    }
    if (abs < 86400 * 35) {
      return relativeFormat.format(Math.round(seconds / (86400 * 7)), "week");
    }
    return formatDay(date);
  }

  function daysBetween(start, end) {
    const a = toDate(start);
    const b = toDate(end || new Date());
    return a && b ? (b.getTime() - a.getTime()) / 86400000 : null;
  }

  function pluralize(count, singular, plural) {
    return count + " " + (count === 1 ? singular : plural || singular + "s");
  }

  function formatNumber(value, digits) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits == null ? 0 : digits }).format(value);
  }

  // A length of time given in days, counted in whole days ("8 days"), or in
  // hours when it is under a day. Null when there is nothing to show.
  function duration(days) {
    if (days == null || !Number.isFinite(days)) {
      return null;
    }
    if (days < 1) {
      const hours = Math.max(1, Math.round(days * 24));
      return { value: hours, unit: hours === 1 ? "hr" : "hrs" };
    }
    const whole = Math.round(days);
    return { value: whole, unit: whole === 1 ? "day" : "days" };
  }

  function durationText(days) {
    const time = duration(days);
    return time ? time.value + " " + time.unit : "—";
  }

  // The same, for big numbers: the unit in a <small> after the value.
  function durationHtml(days) {
    const time = duration(days);
    return time ? time.value + "<small>" + time.unit + "</small>" : "—";
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      const context = this;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fn.apply(context, args);
      }, wait || 150);
    };
  }

  /* ---------- Tags, avatars, photos ---------- */

  function statusLabel(status) {
    return store().statuses[status] || status;
  }

  function statusPill(status) {
    return (
      '<span class="pill status-' +
      escapeHtml(status) +
      '"><span class="pill-dot" aria-hidden="true"></span>' +
      escapeHtml(statusLabel(status)) +
      "</span>"
    );
  }

  // The one High / Medium / Low label used everywhere (see .sev in core.css).
  function severityBadge(severity, options) {
    const value = String(severity || "Medium");
    return (
      '<span class="sev sev-' +
      escapeHtml(value.toLowerCase()) +
      (options && options.className ? " " + options.className : "") +
      '">' +
      escapeHtml(value) +
      (options && options.suffix ? " " + escapeHtml(options.suffix) : "") +
      "</span>"
    );
  }

  // A resident's rating of a finished repair (1 to 5 stars).
  const ratingLabels = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very good", 5: "Excellent" };

  function ratingStars(rating) {
    let stars = "";
    for (let star = 1; star <= 5; star += 1) {
      stars += icon("star", star <= rating ? "star-on" : "star-off");
    }
    return '<span class="rating-display" role="img" aria-label="' + rating + ' out of 5 stars">' + stars + "</span>";
  }

  function initials(name) {
    const parts = String(name || "?")
      .replace(/[^A-Za-zÀ-ž\s.-]/g, "")
      .split(/[\s.]+/)
      .filter(Boolean);
    if (parts.length === 0) {
      return "?";
    }
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || "";
    return (first + last).toUpperCase();
  }

  function toneFor(name) {
    let hash = 0;
    String(name || "").split("").forEach(function (character) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    });
    return (hash % 6) + 1;
  }

  function avatar(name, size) {
    return (
      '<span class="avatar' +
      (size ? " avatar-" + size : "") +
      '" data-tone="' +
      toneFor(name) +
      '" aria-hidden="true">' +
      escapeHtml(initials(name)) +
      "</span>"
    );
  }

  function photoName(photo) {
    return typeof photo === "string" ? photo : (photo && photo.name) || "Photo";
  }

  function photosWithData(list) {
    return (list || [])
      .filter(function (photo) {
        return photo && typeof photo === "object" && photo.src;
      })
      .map(function (photo) {
        return { src: photo.src, alt: photo.name, name: photo.name };
      });
  }

  // Photos to show for a report: the citizen's uploads when they were saved,
  // otherwise the sample road photos the prototype has always used.
  function reportPhotos(report) {
    const uploaded = photosWithData(report && report.evidencePhotos);
    if (uploaded.length) {
      return uploaded;
    }
    return sampleRoadPhotos.map(function (photo) {
      return { src: photo.src, alt: photo.alt, name: photo.alt };
    });
  }

  // The crew's before or after repair photos. Uploads that were saved show as
  // is; sample reports list file names only, so each gets a sample picture.
  // Uploads that couldn't be saved show a placeholder.
  function repairPhotos(report, side) {
    const list = report && report.repair ? report.repair[side === "before" ? "beforePhotos" : "afterPhotos"] : [];
    const uploaded = photosWithData(list);
    if (uploaded.length) {
      return uploaded;
    }
    return (list || []).map(function (photo) {
      const name = photoName(photo);
      if (report.photosTrimmed) {
        return { src: placeholderPhoto, alt: name + " (photo not available)", name: name };
      }
      return { src: sampleRepairPhotos[side === "before" ? "before" : "after"], alt: name + " (sample photo)", name: name };
    });
  }

  // A grid of photo thumbnails. Each opens the lightbox through the page's
  // click handler, which reads the images in the same [data-gallery-group].
  // `className` adds a layout, e.g. "gallery-grid" for an even grid. Without
  // one, the photos fill the full width in a layout made for their number
  // (one to five), whatever their orientation.
  function photoGallery(photos, label, className) {
    if (!photos.length) {
      return '<p class="muted text-sm">No photos</p>';
    }
    const layout = className || (photos.length <= 5 ? "gallery-count-" + photos.length : "gallery-grid");
    return (
      '<div class="gallery ' +
      escapeHtml(layout) +
      '" data-gallery-group aria-label="' +
      escapeHtml(label) +
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
            (photo.alt ? ": " + escapeHtml(photo.alt) : "") +
            '">' +
            photoImg(photo) +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function photoImg(photo, extra) {
    return (
      '<img src="' +
      escapeHtml(photo.src) +
      '" alt="' +
      escapeHtml(photo.alt || "") +
      '" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback' +
      (extra ? " " + extra : "") +
      " />"
    );
  }

  // Remote sample photos can disappear; swap in the branded placeholder.
  document.addEventListener(
    "error",
    function (event) {
      const target = event.target;
      if (target && target.tagName === "IMG" && target.hasAttribute("data-fallback") && !target.dataset.failed) {
        target.dataset.failed = "true";
        target.src = placeholderPhoto;
      }
    },
    true,
  );

  function fileChips(list, emptyText) {
    if (!list || list.length === 0) {
      return '<p class="muted text-sm">' + escapeHtml(emptyText || "No files listed") + "</p>";
    }
    return (
      '<div class="file-chips">' +
      list
        .map(function (photo) {
          return '<span class="file-chip">' + icon("image", "icon-sm") + escapeHtml(photoName(photo)) + "</span>";
        })
        .join("") +
      "</div>"
    );
  }

  function getAssignedName(report, personnel) {
    const person = personnel.find(function (item) {
      return item.id === report.assignedTo;
    });
    return person ? person.name : report.assignedName || "Former personnel";
  }

  function osmUrl(coordinates) {
    const lat = encodeURIComponent(coordinates.lat);
    const lng = encodeURIComponent(coordinates.lng);
    return "https://www.openstreetmap.org/?mlat=" + lat + "&mlon=" + lng + "#map=17/" + lat + "/" + lng;
  }

  function directionsUrl(coordinates) {
    return (
      "https://www.google.com/maps/dir/?api=1&destination=" +
      encodeURIComponent(coordinates.lat + "," + coordinates.lng)
    );
  }

  /* ---------- Journey and timeline ---------- */

  function journey(report, options) {
    const steps = (options && options.steps) || journeyStatuses;
    const closed = ["rejected", "duplicate"].includes(report.status);
    const history = (report.history || []).slice().reverse();
    let currentIndex = steps.indexOf(report.status);
    if (closed || currentIndex < 0) {
      currentIndex = -1;
      steps.forEach(function (status, index) {
        if (history.some(function (item) { return item.status === status; })) {
          currentIndex = index;
        }
      });
    }

    const items = steps
      .map(function (status, index) {
        const item = history.find(function (entry) {
          return entry.status === status;
        });
        let state = "is-upcoming";
        if (!closed && index === currentIndex) {
          state = status === "resolved" ? "is-complete" : "is-current";
        } else if (index < currentIndex || (closed && index === currentIndex)) {
          state = "is-complete";
        }
        const showDate = item && state !== "is-upcoming";
        return (
          '<li class="journey-step ' +
          state +
          '"><span class="journey-marker" aria-hidden="true">' +
          (state === "is-complete" ? icon("check") : "") +
          "</span><strong>" +
          escapeHtml((options && options.labels && options.labels[status]) || statusLabel(status)) +
          '</strong><time class="journey-date">' +
          (showDate ? escapeHtml(formatShortDay(item.at)) : "") +
          "</time>" +
          '<span class="visually-hidden">' +
          (state === "is-current" ? " (current step)" : state === "is-complete" ? " (done)" : " (not reached)") +
          "</span></li>"
        );
      })
      .join("");

    return (
      '<div class="journey-scroll"><ol class="journey' +
      (closed ? " is-closed" : "") +
      '" style="--steps:' +
      steps.length +
      '" aria-label="Report progress">' +
      items +
      "</ol></div>" +
      (closed
        ? '<p class="journey-outcome">' + icon("info", "icon-sm") + "Closed as " + statusPill(report.status) + "</p>"
        : "")
    );
  }

  // Activity list, newest first. `publicOnly` hides notes and staff names,
  // and tells residents and the public that a submitted report went to the
  // administrator (options.submittedText can say it in the resident's words).
  function timeline(report, options) {
    const publicOnly = options && options.publicOnly;
    const submittedText = (options && options.submittedText) || "Report submitted and sent to the administrator.";
    const entries = (report.history || [])
      .slice()
      .reverse()
      .filter(function (entry) {
        return !publicOnly || entry.status !== "note";
      });
    if (entries.length === 0) {
      return '<p class="muted text-sm">No activity yet.</p>';
    }
    return (
      '<ol class="timeline">' +
      entries
        .map(function (entry) {
          const isNote = entry.status === "note";
          const title = isNote
            ? "<strong>" + escapeHtml(entry.actor || "Staff") + "</strong> added a note"
            : publicOnly
              ? "<strong>" +
                escapeHtml(statusLabel(entry.status)) +
                "</strong> · " +
                escapeHtml(entry.status === "submitted" ? submittedText : entry.description)
              : escapeHtml(entry.description);
          const meta = publicOnly
            ? formatDate(entry.at)
            : (entry.actor ? entry.actor + " · " : "") + formatDate(entry.at);
          return (
            '<li class="timeline-item"><span class="timeline-dot status-' +
            escapeHtml(entry.status) +
            (isNote ? " is-note" : "") +
            '" style="--tone: var(--st-' +
            escapeHtml(entry.status) +
            ', var(--text-3))" aria-hidden="true"></span><span class="timeline-title">' +
            title +
            '</span><span class="timeline-meta">' +
            escapeHtml(meta) +
            "</span>" +
            (entry.note && (!publicOnly || entry.status === "rejected")
              ? '<p class="timeline-note">' + escapeHtml(entry.note) + "</p>"
              : "") +
            "</li>"
          );
        })
        .join("") +
      "</ol>"
    );
  }

  /* ---------- Background inert helper ---------- */

  let toastRegion = null;

  function setBackgroundInert(keep) {
    const changed = [];
    Array.from(document.body.children).forEach(function (element) {
      if (keep.includes(element) || element === toastRegion || element.inert || element.tagName === "SCRIPT") {
        return;
      }
      element.inert = true;
      changed.push(element);
    });
    return function () {
      changed.forEach(function (element) {
        element.inert = false;
      });
    };
  }

  function afterAnimation(element, done) {
    if (reducedMotion.matches) {
      done();
      return;
    }
    let finished = false;
    function finish() {
      if (!finished) {
        finished = true;
        done();
      }
    }
    element.addEventListener("animationend", finish, { once: true });
    window.setTimeout(finish, 320);
  }

  /* ---------- Toasts ---------- */

  const toastIcons = { success: "check-circle", error: "alert-circle", info: "info" };
  const toastLabels = { success: "Success", error: "Error", info: "Notice" };

  function getToastRegion() {
    if (!toastRegion) {
      toastRegion = document.createElement("div");
      toastRegion.className = "toast-region";
      toastRegion.setAttribute("aria-live", "polite");
      toastRegion.setAttribute("aria-relevant", "additions");
      document.body.appendChild(toastRegion);
    }
    return toastRegion;
  }

  // A toast closes itself after about four seconds (errors stay a bit longer);
  // hovering or focusing it pauses the timer.
  function showMessage(text, type) {
    const kind = toastIcons[type] ? type : "success";
    const duration = kind === "error" ? 6500 : 4200;
    const region = getToastRegion();
    const toast = document.createElement("div");
    toast.className = "toast toast-" + kind;
    toast.style.setProperty("--toast-duration", duration + "ms");
    if (kind === "error") {
      toast.setAttribute("role", "alert");
    }
    toast.innerHTML =
      '<span class="toast-icon">' +
      icon(toastIcons[kind]) +
      '</span><p class="toast-message"><span class="visually-hidden">' +
      toastLabels[kind] +
      ': </span></p><button class="toast-close" type="button" aria-label="Dismiss notification">' +
      icon("x", "icon-sm") +
      "</button>";
    toast.querySelector(".toast-message").appendChild(document.createTextNode(text));

    let remaining = duration;
    let startedAt = 0;
    let timer = null;
    const pauses = new Set();

    function dismiss() {
      if (toast.classList.contains("is-leaving")) {
        return;
      }
      window.clearTimeout(timer);
      toast.classList.add("is-leaving");
      afterAnimation(toast, function () {
        toast.remove();
      });
    }

    function run() {
      startedAt = Date.now();
      toast.classList.remove("is-paused");
      timer = window.setTimeout(dismiss, remaining);
    }

    function pause(reason) {
      if (pauses.size === 0) {
        window.clearTimeout(timer);
        remaining = Math.max(1000, remaining - (Date.now() - startedAt));
        toast.classList.add("is-paused");
      }
      pauses.add(reason);
    }

    function resume(reason) {
      if (pauses.delete(reason) && pauses.size === 0) {
        run();
      }
    }

    toast.addEventListener("mouseenter", function () {
      pause("hover");
    });
    toast.addEventListener("mouseleave", function () {
      resume("hover");
    });
    toast.addEventListener("focusin", function () {
      pause("focus");
    });
    toast.addEventListener("focusout", function (event) {
      if (!toast.contains(event.relatedTarget)) {
        resume("focus");
      }
    });
    toast.querySelector(".toast-close").addEventListener("click", dismiss);
    toast._dismiss = dismiss;

    region.appendChild(toast);
    const visibleToasts = region.querySelectorAll(".toast:not(.is-leaving)");
    if (visibleToasts.length > 3) {
      visibleToasts[0]._dismiss();
    }
    run();
  }

  /* ---------- Confirm and prompt dialogs ---------- */

  let activeDialog = null;

  // The dialog's icon, with the kicker and title beside it.
  function dialogHead(iconName, kicker, title, titleId) {
    return (
      '<div class="dialog-head"><div class="dialog-icon">' +
      icon(iconName, "icon-lg") +
      '</div><div class="dialog-heading">' +
      (kicker ? '<p class="dialog-kicker">' + escapeHtml(kicker) + "</p>" : "") +
      '<h2 class="dialog-title" id="' +
      titleId +
      '">' +
      escapeHtml(title) +
      "</h2></div></div>"
    );
  }

  // options: title, message, confirmLabel, cancelLabel, kicker, danger, icon,
  // opener, and for prompts: input { label, placeholder, required, multiline,
  // maxLength, value, hint }. Resolves true/false, or the text/null for prompts.
  function openDialog(options, isPrompt) {
    if (activeDialog) {
      activeDialog.settle(false);
    }

    return new Promise(function (resolve) {
      const danger = Boolean(options.danger);
      const input = isPrompt ? options.input || {} : null;
      const backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";
      const titleId = "dialog-title-" + Date.now();
      const messageId = titleId + "-message";
      const iconName = options.icon || (danger ? "alert-triangle" : "info");
      backdrop.innerHTML =
        '<section class="dialog' +
        (danger ? " is-danger" : "") +
        '" role="dialog" aria-modal="true" aria-labelledby="' +
        titleId +
        '"' +
        (options.message ? ' aria-describedby="' + messageId + '"' : "") +
        ">" +
        dialogHead(iconName, options.kicker, options.title, titleId) +
        (options.message ? '<p class="dialog-message" id="' + messageId + '">' + escapeHtml(options.message) + "</p>" : "") +
        (input
          ? '<label class="field dialog-field"><span class="field-label">' +
            escapeHtml(input.label || "Details") +
            (input.required ? "" : ' <span class="optional">Optional</span>') +
            "</span>" +
            (input.multiline === false
              ? '<input type="text" data-dialog-input maxlength="' + (input.maxLength || 300) + '" />'
              : '<textarea data-dialog-input rows="3" maxlength="' + (input.maxLength || 600) + '"></textarea>') +
            (input.hint ? '<span class="field-hint">' + escapeHtml(input.hint) + "</span>" : "") +
            '<span class="field-error" data-dialog-error hidden></span></label>'
          : "") +
        '<div class="dialog-actions"><button class="btn btn-secondary" type="button" data-dialog-cancel>' +
        escapeHtml(options.cancelLabel || "Cancel") +
        '</button><button class="btn ' +
        (danger ? "btn-danger" : "btn-primary") +
        '" type="button" data-dialog-accept>' +
        escapeHtml(options.confirmLabel || "Confirm") +
        "</button></div></section>";

      const field = backdrop.querySelector("[data-dialog-input]");
      if (field) {
        field.placeholder = input.placeholder || "";
        field.value = input.value || "";
      }
      document.body.appendChild(backdrop);
      const opener = options.opener || document.activeElement;
      const restoreInert = setBackgroundInert([backdrop]);

      function focusables() {
        return Array.from(backdrop.querySelectorAll("button, textarea, input")).filter(function (element) {
          return !element.disabled;
        });
      }

      function settle(confirmed) {
        if (activeDialog !== controller) {
          return;
        }
        let result = confirmed;
        if (isPrompt) {
          if (confirmed) {
            const value = field.value.trim();
            if (input.required && !value) {
              const error = backdrop.querySelector("[data-dialog-error]");
              error.textContent = "This field is required.";
              error.hidden = false;
              field.setAttribute("aria-invalid", "true");
              field.focus();
              return;
            }
            result = value;
          } else {
            result = null;
          }
        }
        activeDialog = null;
        document.removeEventListener("keydown", onKeydown, true);
        restoreInert();
        backdrop.classList.add("is-closing");
        afterAnimation(backdrop, function () {
          backdrop.remove();
        });
        if (opener && opener.isConnected && typeof opener.focus === "function") {
          opener.focus({ preventScroll: true });
        }
        resolve(result);
      }

      function onKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          settle(false);
        } else if (event.key === "Tab") {
          const list = focusables();
          const index = list.indexOf(document.activeElement);
          const next = event.shiftKey
            ? (index <= 0 ? list.length : index) - 1
            : (index + 1) % list.length;
          event.preventDefault();
          list[next].focus();
        } else if (event.key === "Enter" && isPrompt && field && field.tagName === "INPUT" && document.activeElement === field) {
          event.preventDefault();
          settle(true);
        }
      }

      backdrop.addEventListener("click", function (event) {
        if (event.target === backdrop || event.target.closest("[data-dialog-cancel]")) {
          settle(false);
        } else if (event.target.closest("[data-dialog-accept]")) {
          settle(true);
        }
      });

      const controller = { settle: settle };
      activeDialog = controller;
      document.addEventListener("keydown", onKeydown, true);
      // Destructive dialogs start on Cancel so a stray Enter is harmless.
      const initial = field || (danger ? backdrop.querySelector("[data-dialog-cancel]") : backdrop.querySelector("[data-dialog-accept]"));
      initial.focus({ preventScroll: true });
    });
  }

  function confirmAction(options) {
    return openDialog(options, false);
  }

  function promptAction(options) {
    return openDialog(options, true);
  }

  /* ---------- Form dialog ---------- */

  // A dialog with several fields that stays open until `submit` succeeds.
  // options: title, message, kicker, icon, confirmLabel, cancelLabel, opener,
  // fields [{ name, label, type, autocomplete, hint }], and submit(values),
  // which returns a promise; throwing shows its message in the dialog.
  // Resolves with what submit returned, or null when cancelled.
  function formDialog(options) {
    if (activeDialog) {
      activeDialog.settle(false);
    }

    return new Promise(function (resolve) {
      const backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";
      const titleId = "dialog-title-" + Date.now();
      const messageId = titleId + "-message";
      backdrop.innerHTML =
        '<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="' +
        titleId +
        '"' +
        (options.message ? ' aria-describedby="' + messageId + '"' : "") +
        "><form novalidate>" +
        dialogHead(options.icon || "info", options.kicker, options.title, titleId) +
        (options.message ? '<p class="dialog-message" id="' + messageId + '">' + escapeHtml(options.message) + "</p>" : "") +
        options.fields
          .map(function (spec) {
            return (
              '<label class="field dialog-field"><span class="field-label">' +
              escapeHtml(spec.label) +
              '</span><input type="' +
              escapeHtml(spec.type || "text") +
              '" name="' +
              escapeHtml(spec.name) +
              '" autocomplete="' +
              escapeHtml(spec.autocomplete || "off") +
              '" spellcheck="false" maxlength="128" />' +
              (spec.hint ? '<span class="field-hint">' + escapeHtml(spec.hint) + "</span>" : "") +
              "</label>"
            );
          })
          .join("") +
        '<p class="field-error dialog-field" role="alert" data-form-error hidden></p>' +
        '<div class="dialog-actions"><button class="btn btn-secondary" type="button" data-dialog-cancel>' +
        escapeHtml(options.cancelLabel || "Cancel") +
        '</button><button class="btn btn-primary" type="submit" data-dialog-accept>' +
        escapeHtml(options.confirmLabel || "Save") +
        "</button></div></form></section>";

      const form = backdrop.querySelector("form");
      const error = backdrop.querySelector("[data-form-error]");
      const accept = backdrop.querySelector("[data-dialog-accept]");
      document.body.appendChild(backdrop);
      const opener = options.opener || document.activeElement;
      const restoreInert = setBackgroundInert([backdrop]);
      let busy = false;

      function focusables() {
        return Array.from(backdrop.querySelectorAll("button, input")).filter(function (element) {
          return !element.disabled;
        });
      }

      function close(result) {
        if (activeDialog !== controller) {
          return;
        }
        activeDialog = null;
        document.removeEventListener("keydown", onKeydown, true);
        restoreInert();
        backdrop.classList.add("is-closing");
        afterAnimation(backdrop, function () {
          backdrop.remove();
        });
        if (opener && opener.isConnected && typeof opener.focus === "function") {
          opener.focus({ preventScroll: true });
        }
        resolve(result);
      }

      function onKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (!busy) {
            close(null);
          }
        } else if (event.key === "Tab") {
          const list = focusables();
          const index = list.indexOf(document.activeElement);
          const next = event.shiftKey ? (index <= 0 ? list.length : index) - 1 : (index + 1) % list.length;
          event.preventDefault();
          list[next].focus();
        }
      }

      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (busy) {
          return;
        }
        const values = {};
        options.fields.forEach(function (spec) {
          values[spec.name] = form.elements[spec.name].value;
        });
        busy = true;
        error.hidden = true;
        accept.classList.add("is-loading");
        accept.setAttribute("aria-busy", "true");
        try {
          close(await options.submit(values));
        } catch (failure) {
          error.textContent = failure.message || "Something went wrong. Try again.";
          error.hidden = false;
          busy = false;
          accept.classList.remove("is-loading");
          accept.removeAttribute("aria-busy");
        }
      });

      backdrop.addEventListener("click", function (event) {
        if (!busy && (event.target === backdrop || event.target.closest("[data-dialog-cancel]"))) {
          close(null);
        }
      });

      const controller = {
        settle: function () {
          close(null);
        },
      };
      activeDialog = controller;
      document.addEventListener("keydown", onKeydown, true);
      form.elements[options.fields[0].name].focus({ preventScroll: true });
    });
  }

  /* ---------- Lightbox ---------- */

  let lightbox = null;

  function openLightbox(images, startIndex, opener) {
    // Older call style: openLightbox({ src, alt }, opener).
    if (!Array.isArray(images)) {
      opener = startIndex;
      images = [images];
      startIndex = 0;
    }
    if (lightbox) {
      lightbox.close(false);
    }
    let index = Math.max(0, Math.min(images.length - 1, startIndex || 0));
    const element = document.createElement("div");
    element.className = "lightbox";
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-modal", "true");
    element.innerHTML =
      '<figure class="lightbox-figure"><img class="lightbox-image" alt="" referrerpolicy="no-referrer" data-fallback /><figcaption class="lightbox-caption"></figcaption></figure>' +
      '<button class="lightbox-btn lightbox-close" type="button" aria-label="Close photo">' +
      icon("x") +
      "</button>" +
      (images.length > 1
        ? '<button class="lightbox-btn lightbox-prev" type="button" aria-label="Previous photo">' +
          icon("chevron-left") +
          '</button><button class="lightbox-btn lightbox-next" type="button" aria-label="Next photo">' +
          icon("chevron-right") +
          "</button>"
        : "");
    document.body.appendChild(element);
    const image = element.querySelector(".lightbox-image");
    const caption = element.querySelector(".lightbox-caption");
    const restoreInert = setBackgroundInert([element]);
    const returnFocus = opener || document.activeElement;

    function show() {
      const photo = images[index];
      delete image.dataset.failed;
      image.src = photo.src;
      image.alt = photo.alt || "";
      caption.textContent =
        (photo.alt || "Photo") + (images.length > 1 ? " · " + (index + 1) + " of " + images.length : "");
      element.setAttribute("aria-label", photo.alt ? "Photo: " + photo.alt : "Photo");
    }

    function step(delta) {
      index = (index + delta + images.length) % images.length;
      show();
    }

    function close(restore) {
      if (!lightbox || lightbox.element !== element) {
        return;
      }
      lightbox = null;
      document.removeEventListener("keydown", onKeydown, true);
      restoreInert();
      element.classList.add("is-closing");
      afterAnimation(element, function () {
        element.remove();
      });
      if (restore !== false && returnFocus && returnFocus.isConnected) {
        returnFocus.focus({ preventScroll: true });
      }
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      } else if (event.key === "ArrowRight" && images.length > 1) {
        step(1);
      } else if (event.key === "ArrowLeft" && images.length > 1) {
        step(-1);
      } else if (event.key === "Tab") {
        const buttons = Array.from(element.querySelectorAll("button"));
        const current = buttons.indexOf(document.activeElement);
        event.preventDefault();
        buttons[(current + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
      }
    }

    element.addEventListener("click", function (event) {
      if (event.target.closest(".lightbox-prev")) {
        step(-1);
      } else if (event.target.closest(".lightbox-next")) {
        step(1);
      } else if (!event.target.closest(".lightbox-image")) {
        close();
      }
    });

    lightbox = { element: element, close: close };
    document.addEventListener("keydown", onKeydown, true);
    show();
    element.querySelector(".lightbox-close").focus({ preventScroll: true });
  }

  /* ---------- Hover photo preview ---------- */

  let photoPreview = null;
  let previewTimer = null;
  let hideActivePreview = null;

  function getPhotoPreview() {
    if (!photoPreview) {
      photoPreview = document.createElement("div");
      photoPreview.className = "photo-preview";
      photoPreview.setAttribute("aria-hidden", "true");
      photoPreview.innerHTML = '<img alt="" referrerpolicy="no-referrer" />';
      document.body.appendChild(photoPreview);
    }
    return photoPreview;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function placePhotoPreview(target, image) {
    const preview = getPhotoPreview();
    const rect = target.getBoundingClientRect();
    const margin = 12;
    const gap = 14;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 4 / 3;
    const maxHeight = Math.min(viewportHeight * 0.6, viewportHeight - margin * 2);
    let width = Math.min(440, viewportWidth - margin * 2);
    let height = width / ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }

    let left = null;
    let top;
    let origin;
    if (rect.right + gap + width <= viewportWidth - margin) {
      left = rect.right + gap;
      origin = "left center";
    } else if (rect.left - gap - width >= margin) {
      left = rect.left - gap - width;
      origin = "right center";
    }
    if (left !== null) {
      top = rect.top + rect.height / 2 - height / 2;
    } else {
      left = rect.left + rect.width / 2 - width / 2;
      if (rect.bottom + gap + height <= viewportHeight - margin) {
        top = rect.bottom + gap;
        origin = "top center";
      } else {
        top = rect.top - gap - height;
        origin = "bottom center";
      }
    }

    preview.style.left = clamp(left, margin, viewportWidth - margin - width) + "px";
    preview.style.top = clamp(top, margin, viewportHeight - margin - height) + "px";
    preview.style.width = width + "px";
    preview.style.height = height + "px";
    preview.style.setProperty("--preview-origin", origin);
  }

  // options: selector (the thumbnail), getImage(thumbnail) returning the <img>
  // to enlarge, and optional onShow(thumbnail) / onHide(thumbnail, event).
  function bindPhotoPreview(root, options) {
    let current = null;

    function hide(event) {
      window.clearTimeout(previewTimer);
      if (!current) {
        return;
      }
      const target = current;
      current = null;
      hideActivePreview = null;
      getPhotoPreview().classList.remove("is-visible");
      if (options.onHide) {
        options.onHide(target, event || null);
      }
    }

    root.addEventListener("pointerover", function (event) {
      if (event.pointerType !== "mouse") {
        return;
      }
      const target = event.target.closest(options.selector);
      if (!target || !root.contains(target) || target === current || target.contains(event.relatedTarget)) {
        return;
      }
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(function () {
        const image = options.getImage(target);
        if (!image || !target.isConnected) {
          return;
        }
        if (hideActivePreview) {
          hideActivePreview();
        }
        const preview = getPhotoPreview();
        preview.querySelector("img").src = image.currentSrc || image.src;
        placePhotoPreview(target, image);
        preview.classList.add("is-visible");
        current = target;
        hideActivePreview = hide;
        if (options.onShow) {
          options.onShow(target);
        }
      }, 450);
    });

    root.addEventListener("pointerout", function (event) {
      if (event.pointerType !== "mouse") {
        return;
      }
      const target = event.target.closest(options.selector);
      if (!target || target.contains(event.relatedTarget)) {
        return;
      }
      window.clearTimeout(previewTimer);
      if (target === current) {
        hide(event);
      }
    });
  }

  function hidePhotoPreview() {
    window.clearTimeout(previewTimer);
    if (hideActivePreview) {
      hideActivePreview();
    }
  }
  window.addEventListener("scroll", hidePhotoPreview, true);
  document.addEventListener("pointerdown", hidePhotoPreview);

  /* ---------- Files ---------- */

  function csvCell(value) {
    let text = value == null ? "" : String(value);
    // Keep spreadsheet apps from treating report text as a formula.
    if (/^[=+\-@\t\r]/.test(text)) {
      text = "'" + text;
    }
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function downloadCsv(filename, rows) {
    const csv = rows
      .map(function (row) {
        return row.map(csvCell).join(",");
      })
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  // Shrinks a photo to a JPEG data URL for the preview; the store uploads it
  // to the server's photo storage when the form is sent.
  function readImageFile(file, options) {
    const maxSize = (options && options.maxSize) || 1600;
    const quality = (options && options.quality) || 0.82;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error(file ? file.name + " is not an image." : "Choose an image."));
        return;
      }
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = function () {
        const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        try {
          resolve({ name: file.name, src: canvas.toDataURL("image/jpeg", quality) });
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read " + file.name + "."));
      };
      image.src = url;
    });
  }

  /* ---------- Maps ---------- */

  const mapCenter = [14.866, 120.83];
  const schematicBounds = { north: 14.94, south: 14.82, west: 120.75, east: 121.0 };
  // Pin size in pixels (the drawing is 28 × 36; see .map-pin in core.css).
  const pinSize = [22, 28];
  const pinSvg =
    '<svg viewBox="0 0 28 36" aria-hidden="true" focusable="false"><path class="pin-shape" d="M26.5 13.5c0 9-12.5 22.5-12.5 22.5S1.5 22.5 1.5 13.5a12.5 12.5 0 1 1 25 0Z"/><circle class="pin-dot" cx="14" cy="13.5" r="4.5"/></svg>';
  const mapControllers = new WeakMap();

  function hasLeaflet() {
    return Boolean(window.L && typeof window.L.map === "function");
  }

  // OpenStreetMap's standard tiles need no API key, only attribution. CSS
  // filters in core.css tone them down (and invert them for the dark theme).
  const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  function pinMarkup(report, pulse) {
    const severity = String(report.severity || "medium").toLowerCase();
    return (
      '<span class="map-pin pin-' +
      escapeHtml(severity) +
      (pulse ? " is-pulse" : "") +
      '" style="--pin-tone: var(--sev-' +
      escapeHtml(severity) +
      ')">' +
      pinSvg +
      "</span>"
    );
  }

  function markerLabel(report) {
    return report.id + ", " + report.title + ", " + report.severity + " severity, " + statusLabel(report.status);
  }

  // Default popup body for a report marker. `action: false` leaves out the
  // button.
  function reportPopup(report, options) {
    const photo = reportPhotos(report)[0];
    const actionLabel = (options && options.actionLabel) || "View details";
    const action = options && options.action === false ? null : (options && options.action) || "open";
    return (
      '<div class="map-popup"><div class="map-popup-media">' +
      photoImg(photo) +
      severityBadge(report.severity) +
      '</div><div class="map-popup-body"><span class="id-tag">' +
      escapeHtml(report.id) +
      " · " +
      escapeHtml(formatShortDay(report.reportedAt)) +
      "</span><strong>" +
      escapeHtml(report.title) +
      '</strong><div class="map-popup-meta"><span>' +
      escapeHtml(report.road) +
      "</span>" +
      statusPill(report.status) +
      "</div>" +
      (action
        ? '<button class="btn btn-primary btn-sm btn-block" type="button" data-map-action="' +
          escapeHtml(action) +
          '" data-report-id="' +
          escapeHtml(report.id) +
          '">' +
          escapeHtml(actionLabel) +
          icon("arrow-right", "icon-sm") +
          "</button>"
        : "") +
      "</div></div>"
    );
  }

  function validReports(reports) {
    return (reports || []).filter(function (report) {
      return (
        report.coordinates &&
        Number.isFinite(Number(report.coordinates.lat)) &&
        Number.isFinite(Number(report.coordinates.lng))
      );
    });
  }

  function bindPopupActions(element, options) {
    element.querySelectorAll("[data-map-action]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (options.onAction) {
          options.onAction(button.dataset.mapAction, button.dataset.reportId, button);
        }
      });
    });
  }

  function emptyOverlay(container, message, show) {
    let overlay = container.querySelector(":scope > .map-empty-overlay");
    if (!show) {
      if (overlay) {
        overlay.remove();
      }
      return;
    }
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "map-empty-overlay";
      overlay.innerHTML = "<span></span>";
      container.appendChild(overlay);
    }
    overlay.firstChild.textContent = message || "No reports to show on the map.";
  }

  function leafletImplementation(container, controller) {
    const L = window.L;
    container.innerHTML = "";
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.inset = "0";
    container.appendChild(host);

    const map = L.map(host, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
      zoomSnap: 0.5,
      worldCopyJump: false,
    }).setView(mapCenter, 11);
    map.attributionControl.setPrefix(false);

    const tiles = L.tileLayer(tileUrl, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    let loadedTiles = 0;
    let failedTiles = 0;
    tiles.on("tileload", function () {
      loadedTiles += 1;
    });
    tiles.on("tileerror", function () {
      failedTiles += 1;
      if (loadedTiles === 0 && failedTiles >= 6) {
        window.setTimeout(function () {
          controller.useFallback("Live map tiles are unavailable, so this is a schematic view.");
        }, 0);
      }
    });

    // Scroll-to-zoom only after the map is clicked, so the page still scrolls.
    map.on("click", function () {
      map.scrollWheelZoom.enable();
    });
    host.addEventListener("mouseleave", function () {
      map.scrollWheelZoom.disable();
    });

    const layer = L.featureGroup().addTo(map);
    const markers = new Map();
    let options = {};

    // Pointing at a pin shows its report right away and hides it again when
    // the pointer leaves (with a moment to reach the popup's button).
    // Clicking or tapping a pin keeps its report open until it's closed.
    let closeTimer = null;

    function cancelClose() {
      window.clearTimeout(closeTimer);
    }

    function closeSoon(popup) {
      cancelClose();
      closeTimer = window.setTimeout(function () {
        if (popup.rrHover && map.hasLayer(popup)) {
          map.closePopup(popup);
        }
      }, 250);
    }

    function showPopup(marker, hover) {
      const popup = marker.rrPopup;
      if (!popup) {
        return;
      }
      cancelClose();
      if (map.hasLayer(popup)) {
        if (!hover) {
          popup.rrHover = false;
        }
        return;
      }
      popup.rrHover = hover;
      // A popup shown on hover never moves the map under the pointer.
      popup.options.autoPan = !hover;
      popup.setLatLng(marker.getLatLng()).openOn(map);
    }

    map.on("popupopen", function (event) {
      const element = event.popup.getElement();
      bindPopupActions(element, options);
      if (!element.rrHoverBound) {
        element.rrHoverBound = true;
        element.addEventListener("mouseenter", cancelClose);
        element.addEventListener("mouseleave", function () {
          if (event.popup.rrHover) {
            closeSoon(event.popup);
          }
        });
      }
    });

    function update(reports, nextOptions) {
      options = nextOptions || {};
      cancelClose();
      map.closePopup();
      layer.clearLayers();
      markers.clear();
      const list = validReports(reports);
      list.forEach(function (report) {
        const pulse = options.pulse ? options.pulse(report) : false;
        const marker = L.marker([Number(report.coordinates.lat), Number(report.coordinates.lng)], {
          icon: L.divIcon({
            className: "rr-pin-icon",
            html: pinMarkup(report, pulse),
            iconSize: pinSize,
            iconAnchor: [pinSize[0] / 2, pinSize[1]],
            popupAnchor: [0, 2 - pinSize[1]],
          }),
          keyboard: true,
          riseOnHover: true,
          // With a popup, hovering already shows the report.
          title: options.popup === false ? report.id + " · " + report.road : "",
        });
        if (options.popup !== false) {
          const content = typeof options.popup === "function" ? options.popup(report) : reportPopup(report, options);
          const popup = L.popup(
            {
              maxWidth: 260,
              minWidth: 240,
              autoPanPadding: [24, 24],
              className: "rr-popup",
            },
            marker,
          ).setContent(content);
          marker.rrPopup = popup;
          marker.on("mouseover", function () {
            showPopup(marker, true);
          });
          marker.on("mouseout", function () {
            if (popup.rrHover) {
              closeSoon(popup);
            }
          });
        }
        marker.on("click", function () {
          showPopup(marker, false);
          if (options.onSelect) {
            options.onSelect(report.id);
          }
        });
        // Enter on a focused pin does the same as a click.
        marker.on("keypress", function (event) {
          if (event.originalEvent && event.originalEvent.key === "Enter") {
            marker.fire("click");
          }
        });
        marker.on("add", function () {
          const element = marker.getElement();
          if (element) {
            element.setAttribute("aria-label", markerLabel(report));
            element.setAttribute("role", "button");
          }
        });
        marker.addTo(layer);
        markers.set(report.id, marker);
      });

      emptyOverlay(container, options.emptyMessage, list.length === 0);
      if (options.fit === false) {
        return;
      }
      if (list.length === 1) {
        map.setView(markers.values().next().value.getLatLng(), options.zoom || 15, { animate: false });
      } else if (list.length > 1) {
        map.fitBounds(layer.getBounds(), { padding: [42, 42], maxZoom: 15, animate: false });
      } else {
        map.setView(mapCenter, 11, { animate: false });
      }
    }

    function focus(reportId, focusOptions) {
      const marker = markers.get(reportId);
      if (!marker) {
        return;
      }
      map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: reducedMotion.matches ? 0 : 0.6 });
      if (!focusOptions || focusOptions.openPopup !== false) {
        window.setTimeout(function () {
          showPopup(marker, false);
        }, reducedMotion.matches ? 0 : 650);
      }
    }

    const resizeObserver = new ResizeObserver(function () {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    return {
      kind: "leaflet",
      map: map,
      update: update,
      focus: focus,
      refresh: function () {
        map.invalidateSize();
      },
      destroy: function () {
        resizeObserver.disconnect();
        map.remove();
        container.innerHTML = "";
      },
    };
  }

  function schematicImplementation(container, controller, notice) {
    let options = {};
    let reportsById = new Map();

    function closePopup() {
      const popup = container.querySelector(".map-fallback-popup");
      if (popup) {
        popup.remove();
      }
      container.querySelectorAll(".map-pin.is-active").forEach(function (pin) {
        pin.classList.remove("is-active");
      });
    }

    function openPopup(marker, report) {
      closePopup();
      if (options.popup === false) {
        return;
      }
      const canvas = container.querySelector(".map-canvas");
      const popup = document.createElement("div");
      popup.className = "map-fallback-popup";
      popup.innerHTML =
        '<button class="map-fallback-close" type="button" aria-label="Close">' +
        icon("x", "icon-sm") +
        "</button>" +
        (typeof options.popup === "function" ? options.popup(report) : reportPopup(report, options));
      const half = Math.min(120, canvas.clientWidth / 2 - 8);
      popup.style.left = clamp(marker.offsetLeft, half + 8, canvas.clientWidth - half - 8) + "px";
      popup.style.top = marker.offsetTop + "px";
      canvas.appendChild(popup);
      if (marker.offsetTop - 38 < popup.offsetHeight + 8) {
        popup.classList.add("is-below");
      }
      marker.querySelector(".map-pin").classList.add("is-active");
      bindPopupActions(popup, options);
      popup.querySelector(".map-fallback-close").addEventListener("click", closePopup);
    }

    function update(reports, nextOptions) {
      options = nextOptions || {};
      const list = validReports(reports);
      reportsById = new Map(
        list.map(function (report) {
          return [report.id, report];
        }),
      );
      const markers = list
        .map(function (report) {
          const x = ((Number(report.coordinates.lng) - schematicBounds.west) / (schematicBounds.east - schematicBounds.west)) * 100;
          const y = ((schematicBounds.north - Number(report.coordinates.lat)) / (schematicBounds.north - schematicBounds.south)) * 100;
          return (
            '<button class="map-pin-button" type="button" style="left:clamp(1rem, ' +
            clamp(x, 0, 100).toFixed(2) +
            "%, calc(100% - 1rem));top:clamp(2.6rem, " +
            clamp(y, 0, 100).toFixed(2) +
            '%, calc(100% - 0.25rem))" data-map-report="' +
            escapeHtml(report.id) +
            '" aria-label="' +
            escapeHtml(markerLabel(report)) +
            '" title="' +
            escapeHtml(report.id + " · " + report.road) +
            '">' +
            pinMarkup(report, options.pulse ? options.pulse(report) : false) +
            "</button>"
          );
        })
        .join("");

      container.innerHTML =
        '<div class="map-canvas" role="group" aria-label="Schematic report map of Bulacan">' +
        '<svg class="map-roads" viewBox="0 0 800 420" preserveAspectRatio="none" aria-hidden="true">' +
        '<path d="M-40 338 C 130 270, 225 340, 390 205 S 610 90, 850 50"/>' +
        '<path d="M-40 125 C 145 185, 244 116, 420 145 S 675 340, 850 252"/>' +
        '<path d="M205 -25 C 265 112, 350 225, 400 460"/>' +
        '<path d="M610 -25 C 570 106, 608 248, 745 460"/>' +
        '<path class="map-road-main" d="M-30 220 C 134 175, 260 202, 408 224 S 634 248, 835 120"/>' +
        "</svg>" +
        '<span class="map-label map-label-market">Malolos City</span>' +
        '<span class="map-label map-label-highway">MacArthur Hwy</span>' +
        markers +
        "</div>" +
        (notice ? '<p class="map-notice">' + escapeHtml(notice) + "</p>" : "");
      emptyOverlay(container, options.emptyMessage, list.length === 0);
    }

    function onClick(event) {
      const marker = event.target.closest("[data-map-report]");
      if (!marker) {
        if (!event.target.closest(".map-fallback-popup")) {
          closePopup();
        }
        return;
      }
      const report = reportsById.get(marker.dataset.mapReport);
      if (!report) {
        return;
      }
      openPopup(marker, report);
      if (options.onSelect) {
        options.onSelect(report.id);
      }
    }
    container.addEventListener("click", onClick);

    // Pointing at a pin shows its report right away, as on the live map.
    function onPointerOver(event) {
      const marker = event.pointerType === "mouse" && event.target.closest("[data-map-report]");
      const active = container.querySelector(".map-pin.is-active");
      if (!marker || (active && marker.contains(active))) {
        return;
      }
      const report = reportsById.get(marker.dataset.mapReport);
      if (report) {
        openPopup(marker, report);
      }
    }
    container.addEventListener("pointerover", onPointerOver);

    return {
      kind: "schematic",
      update: update,
      focus: function (reportId, focusOptions) {
        const marker = container.querySelector('[data-map-report="' + CSS.escape(reportId) + '"]');
        if (marker && (!focusOptions || focusOptions.openPopup !== false)) {
          openPopup(marker, reportsById.get(reportId));
        }
      },
      refresh: function () {},
      destroy: function () {
        container.removeEventListener("click", onClick);
        container.removeEventListener("pointerover", onPointerOver);
        container.innerHTML = "";
      },
    };
  }

  // Draws (or redraws) report pins in `container` and returns a controller
  // with focus(reportId), refresh(), and destroy().
  // options: emptyMessage, popup (false | fn(report) => html), actionLabel,
  // action, onAction(action, reportId), onSelect(reportId), pulse(report),
  // fit (default true), zoom (single report).
  function renderMap(container, reports, options) {
    if (!container) {
      return null;
    }
    container.classList.add("map");
    let controller = mapControllers.get(container);
    if (!controller) {
      let implementation = null;
      let last = { reports: [], options: {} };
      controller = {
        get kind() {
          return implementation ? implementation.kind : null;
        },
        get map() {
          return implementation && implementation.map;
        },
        update: function (nextReports, nextOptions) {
          last = { reports: nextReports, options: nextOptions || {} };
          if (!implementation) {
            try {
              implementation = hasLeaflet()
                ? leafletImplementation(container, controller)
                : schematicImplementation(container, controller, null);
            } catch (error) {
              console.error("Could not start the live map.", error);
              implementation = schematicImplementation(container, controller, "Showing a schematic map.");
            }
          }
          implementation.update(last.reports, last.options);
        },
        focus: function (reportId, focusOptions) {
          if (implementation) {
            implementation.focus(reportId, focusOptions);
          }
        },
        refresh: function () {
          if (implementation) {
            implementation.refresh();
          }
        },
        useFallback: function (notice) {
          if (implementation && implementation.kind === "schematic") {
            return;
          }
          if (implementation) {
            implementation.destroy();
          }
          implementation = schematicImplementation(container, controller, notice);
          implementation.update(last.reports, last.options);
        },
        destroy: function () {
          if (implementation) {
            implementation.destroy();
          }
          implementation = null;
          mapControllers.delete(container);
        },
      };
      mapControllers.set(container, controller);
    }
    controller.update(reports, options);
    return controller;
  }

  // A bare Leaflet map with ResQRoad's tiles, for custom maps such as the
  // citizen location picker. Returns null when Leaflet is unavailable.
  function createBaseMap(host, options) {
    if (!hasLeaflet()) {
      return null;
    }
    const L = window.L;
    const map = L.map(host, Object.assign({ zoomControl: true, scrollWheelZoom: false, zoomSnap: 0.5 }, options || {}));
    map.attributionControl.setPrefix(false);
    L.tileLayer(tileUrl, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    map.on("click", function () {
      map.scrollWheelZoom.enable();
    });
    host.addEventListener("mouseleave", function () {
      map.scrollWheelZoom.disable();
    });
    const resizeObserver = new ResizeObserver(function () {
      map.invalidateSize();
    });
    resizeObserver.observe(host);
    return map;
  }

  function pinIcon(severity, pulse) {
    return window.L.divIcon({
      className: "rr-pin-icon",
      html: pinMarkup({ severity: severity || "Medium" }, pulse),
      iconSize: pinSize,
      iconAnchor: [pinSize[0] / 2, pinSize[1]],
      popupAnchor: [0, 2 - pinSize[1]],
    });
  }

  // A map's refresh button: reloads every report from the server, then
  // `redraw()` draws the map again. The icon spins while it works, and
  // clicks wait until the refresh is done.
  function refreshMap(button, redraw) {
    if (button.getAttribute("aria-busy") === "true") {
      return;
    }
    button.setAttribute("aria-busy", "true");
    button.disabled = true;
    button.classList.add("is-spinning");
    const minimumSpin = new Promise(function (resolve) {
      window.setTimeout(resolve, 450);
    });
    Promise.all([store().refresh(), minimumSpin])
      .then(function () {
        if (redraw) {
          redraw();
        }
        showMessage("Map updated with the latest reports.", "info");
      })
      .catch(function (error) {
        showMessage(error.message, "error");
      })
      .finally(function () {
        button.removeAttribute("aria-busy");
        button.disabled = false;
        button.classList.remove("is-spinning");
      });
  }

  function mapLegend() {
    return (
      '<div class="map-legend" aria-label="Map legend">' +
      '<span><i class="legend-dot is-high"></i>High severity</span>' +
      '<span><i class="legend-dot is-medium"></i>Medium severity</span>' +
      '<span><i class="legend-dot is-low"></i>Low severity</span></div>'
    );
  }

  // A toast to show on the next page, e.g. after signing in or registering.
  const flashKey = "resqroad-flash";

  function flash(text, type) {
    try {
      sessionStorage.setItem(flashKey, JSON.stringify({ text: text, type: type || "success" }));
    } catch (error) {
      // Not critical; the next page just won't show the message.
    }
  }

  function showFlash() {
    try {
      const saved = sessionStorage.getItem(flashKey);
      if (saved) {
        sessionStorage.removeItem(flashKey);
        const message = JSON.parse(saved);
        window.setTimeout(function () {
          showMessage(message.text, message.type);
        }, 350);
      }
    } catch (error) {
      // Ignore malformed or unavailable flash messages.
    }
  }

  getToastRegion();
  showFlash();

  window.RoadWatchUI = {
    flash: flash,
    icon: icon,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    formatDay: formatDay,
    formatShortDay: formatShortDay,
    relativeTime: relativeTime,
    daysBetween: daysBetween,
    pluralize: pluralize,
    formatNumber: formatNumber,
    durationText: durationText,
    durationHtml: durationHtml,
    debounce: debounce,
    statusLabel: statusLabel,
    statusPill: statusPill,
    severityBadge: severityBadge,
    ratingLabels: ratingLabels,
    ratingStars: ratingStars,
    initials: initials,
    avatar: avatar,
    reportPhotos: reportPhotos,
    repairPhotos: repairPhotos,
    photoGallery: photoGallery,
    photosWithData: photosWithData,
    photoImg: photoImg,
    photoName: photoName,
    fileChips: fileChips,
    sampleRoadPhotos: sampleRoadPhotos,
    placeholderPhoto: placeholderPhoto,
    getAssignedName: getAssignedName,
    osmUrl: osmUrl,
    directionsUrl: directionsUrl,
    journey: journey,
    journeyStatuses: journeyStatuses,
    timeline: timeline,
    showMessage: showMessage,
    confirm: confirmAction,
    prompt: promptAction,
    form: formDialog,
    openLightbox: openLightbox,
    bindPhotoPreview: bindPhotoPreview,
    downloadCsv: downloadCsv,
    readImageFile: readImageFile,
    renderMap: renderMap,
    reportPopup: reportPopup,
    mapLegend: mapLegend,
    createBaseMap: createBaseMap,
    pinIcon: pinIcon,
    refreshMap: refreshMap,
    mapCenter: mapCenter,
    hasLeaflet: hasLeaflet,
    setBackgroundInert: setBackgroundInert,
  };
})();
