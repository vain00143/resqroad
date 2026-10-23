/* Public report tracker: look a report up by ID and show its public progress.
   Reporter details and internal staff notes are never shown here. */
(async function () {
  "use strict";

  const store = window.RoadWatchStore;
  const ui = window.RoadWatchUI;
  const publicView = window.RoadWatchPublicView;
  const icon = ui.icon;
  const esc = ui.escapeHtml;
  const recentKey = "resqroad-recent-tracks";
  const form = document.getElementById("track-form");
  const input = document.getElementById("track-input");
  const result = document.getElementById("track-result");
  const recent = document.getElementById("recent-ids");
  let map = null;
  let currentId = "";

  const normalize = publicView.normalizeId;

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
    result.innerHTML = publicView.trackCard(report, {
      headActions:
        '<button class="btn btn-secondary btn-sm" type="button" id="copy-link">' + icon("copy", "icon-sm") + "Copy link</button>",
    });

    map = ui.renderMap(result.querySelector("[data-track-map]"), [report], {
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
    const photo = event.target.closest("[data-gallery-index]");
    if (photo) {
      const images = Array.from(photo.closest("[data-gallery-group]").querySelectorAll("img")).map(function (image) {
        return { src: image.currentSrc || image.src, alt: image.alt };
      });
      ui.openLightbox(images, Number(photo.dataset.galleryIndex), photo);
      return;
    }
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
