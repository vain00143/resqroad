/* Page chrome shared by every ResQRoad page: light/dark theme, the workspace
   sidebar, popover menus, the Ctrl+K command palette, the notifications
   panel. Pages plug content into the palette and
   notifications through window.RoadWatchShell. */
(function () {
  "use strict";

  const themeKey = "resqroad-theme";
  const sidebarKey = "resqroad-sidebar";
  const root = document.documentElement;
  const icon = window.RoadWatchIcons.svg;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

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
      // Preferences are a convenience; ignore storage that is unavailable.
    }
  }

  function ui() {
    return window.RoadWatchUI;
  }

  function escapeHtml(value) {
    return ui() ? ui().escapeHtml(value) : String(value);
  }

  /* ---------- Theme ---------- */

  function currentTheme() {
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  function setTheme(theme, persist) {
    root.dataset.theme = theme;
    if (persist) {
      writePref(themeKey, theme);
    }
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      const dark = theme === "dark";
      button.setAttribute("aria-pressed", String(dark));
      button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
      button.title = dark ? "Light theme" : "Dark theme";
    });
    document.dispatchEvent(new CustomEvent("resqroad:theme", { detail: { theme: theme } }));
  }

  // Follow the system setting until the person picks a theme themselves.
  // The public site, sign-in, and registration always stay dark
  // (<html data-theme-fixed>); only the workspaces have the theme switch.
  const fixedTheme = root.hasAttribute("data-theme-fixed");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  systemDark.addEventListener("change", function (event) {
    if (!fixedTheme && !readPref(themeKey)) {
      setTheme(event.matches ? "dark" : "light", false);
    }
  });

  document.addEventListener("click", function (event) {
    if (event.target.closest("[data-theme-toggle]")) {
      setTheme(currentTheme() === "dark" ? "light" : "dark", true);
    }
  });

  /* ---------- Sidebar ---------- */

  const shell = document.querySelector(".shell");

  function closeNav() {
    if (shell && shell.classList.contains("is-nav-open")) {
      shell.classList.remove("is-nav-open");
      const opener = document.querySelector("[data-sidebar-open]");
      if (opener) {
        opener.setAttribute("aria-expanded", "false");
        opener.focus({ preventScroll: true });
      }
    }
  }

  if (shell) {
    const collapseButton = shell.querySelector("[data-sidebar-collapse]");

    function syncCollapse() {
      const collapsed = shell.classList.contains("is-collapsed");
      if (collapseButton) {
        collapseButton.setAttribute("aria-expanded", String(!collapsed));
        collapseButton.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
        collapseButton.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
      }
    }

    if (readPref(sidebarKey) === "collapsed") {
      shell.classList.add("is-collapsed");
    }
    syncCollapse();

    if (collapseButton) {
      collapseButton.addEventListener("click", function () {
        shell.classList.toggle("is-collapsed");
        writePref(sidebarKey, shell.classList.contains("is-collapsed") ? "collapsed" : "expanded");
        syncCollapse();
      });
    }

    document.querySelectorAll("[data-sidebar-open]").forEach(function (button) {
      button.addEventListener("click", function () {
        shell.classList.add("is-nav-open");
        button.setAttribute("aria-expanded", "true");
        const active = shell.querySelector(".sidebar .nav-item.is-active") || shell.querySelector(".sidebar .nav-item");
        if (active) {
          window.setTimeout(function () {
            active.focus({ preventScroll: true });
          }, 60);
        }
      });
    });

    shell.addEventListener("click", function (event) {
      if (event.target.closest("[data-sidebar-close]")) {
        closeNav();
      } else if (event.target.closest(".sidebar .nav-item") && window.matchMedia("(max-width: 1024px)").matches) {
        shell.classList.remove("is-nav-open");
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && shell.classList.contains("is-nav-open")) {
        closeNav();
      }
    });
  }

  /* ---------- Popovers ---------- */

  let openPopover = null;

  function placePopover(trigger, popover) {
    const rect = trigger.getBoundingClientRect();
    const placement = trigger.dataset.popoverPlacement || "bottom-end";
    const gap = 8;
    // data-popover-width="trigger": as wide as the button that opened it
    // (CSS min-width still applies, e.g. on the collapsed sidebar).
    popover.style.width = trigger.dataset.popoverWidth === "trigger" ? rect.width + "px" : "";
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    let top = placement.startsWith("top") ? rect.top - gap - height : rect.bottom + gap;
    let left = placement.endsWith("start") ? rect.left : rect.right - width;
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - gap - height);
    }
    if (top < 8) {
      top = rect.bottom + gap;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const above = top < rect.top;
    popover.style.top = top + "px";
    popover.style.left = left + "px";
    popover.style.transformOrigin = (above ? "bottom " : "top ") + (placement.endsWith("start") ? "left" : "right");
    // A menu above its button slides up into place; one below slides down.
    popover.style.setProperty("--menu-shift", above ? "10px" : "-6px");
  }

  function closePopover(restoreFocus) {
    if (!openPopover) {
      return;
    }
    const { trigger, popover, onClose } = openPopover;
    openPopover = null;
    trigger.setAttribute("aria-expanded", "false");
    popover.classList.add("is-closing");
    window.setTimeout(function () {
      popover.classList.remove("is-closing");
      if (!openPopover || openPopover.popover !== popover) {
        popover.hidden = true;
      }
    }, 130);
    if (onClose) {
      onClose();
    }
    if (restoreFocus) {
      trigger.focus({ preventScroll: true });
    }
  }

  function showPopover(trigger, popover, onClose) {
    closePopover(false);
    if (popover.parentNode !== document.body) {
      // Fixed positioning must not be trapped by a transformed or blurred parent.
      document.body.appendChild(popover);
    }
    popover.style.position = "fixed";
    popover.hidden = false;
    popover.classList.remove("is-closing");
    placePopover(trigger, popover);
    trigger.setAttribute("aria-expanded", "true");
    openPopover = { trigger: trigger, popover: popover, onClose: onClose };
    const first = popover.querySelector(".menu-item, button, a");
    if (first && trigger.dataset.popoverFocus !== "false") {
      first.focus({ preventScroll: true });
    }
  }

  document.addEventListener("click", function (event) {
    const trigger = event.target.closest("[data-popover-target]");
    if (trigger) {
      const popover = document.getElementById(trigger.dataset.popoverTarget);
      if (!popover) {
        return;
      }
      if (openPopover && openPopover.trigger === trigger) {
        closePopover(false);
      } else {
        showPopover(trigger, popover);
      }
      return;
    }
    if (openPopover && event.target.closest(".popover .menu-item")) {
      closePopover(false);
    }
  });

  document.addEventListener("pointerdown", function (event) {
    if (
      openPopover &&
      !openPopover.popover.contains(event.target) &&
      !openPopover.trigger.contains(event.target)
    ) {
      closePopover(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (!openPopover) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePopover(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const items = Array.from(openPopover.popover.querySelectorAll(".menu-item, .notif-item"));
      if (items.length === 0) {
        return;
      }
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index <= 0 ? items.length : index) - 1;
      items[next].focus();
    } else if (event.key === "Tab") {
      closePopover(false);
    }
  });

  window.addEventListener("resize", function () {
    closePopover(false);
  });

  /* ---------- Command palette ---------- */

  let commandSource = null;
  let palette = null;

  function setCommandSource(source) {
    commandSource = source;
  }

  function closePalette() {
    if (!palette) {
      return;
    }
    const current = palette;
    palette = null;
    current.restoreInert();
    document.removeEventListener("keydown", current.onKeydown, true);
    current.backdrop.remove();
    if (current.opener && current.opener.isConnected) {
      current.opener.focus({ preventScroll: true });
    }
  }

  function openPalette(opener) {
    if (!commandSource || palette) {
      return;
    }
    const backdrop = document.createElement("div");
    backdrop.className = "cmdk-backdrop";
    backdrop.innerHTML =
      '<div class="cmdk" role="dialog" aria-modal="true" aria-label="Search ResQRoad">' +
      '<div class="cmdk-input">' +
      icon("search") +
      '<input type="text" role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list" placeholder="Search reports, roads, people, or pages…" autocomplete="off" spellcheck="false" />' +
      '<span class="kbd">Esc</span></div>' +
      '<ul class="cmdk-list" id="cmdk-list" role="listbox" aria-label="Results"></ul>' +
      '<div class="cmdk-footer"><span><span class="kbd">↑</span><span class="kbd">↓</span> to navigate</span><span><span class="kbd">↵</span> to open</span></div></div>';
    document.body.appendChild(backdrop);
    const input = backdrop.querySelector("input");
    const list = backdrop.querySelector(".cmdk-list");
    let items = [];
    let active = 0;

    function setActive(index) {
      active = index;
      list.querySelectorAll(".cmdk-item").forEach(function (element, itemIndex) {
        const isActive = itemIndex === index;
        element.classList.toggle("is-active", isActive);
        element.setAttribute("aria-selected", String(isActive));
        if (isActive) {
          input.setAttribute("aria-activedescendant", element.id);
          element.scrollIntoView({ block: "nearest" });
        }
      });
    }

    function render() {
      const groups = commandSource(input.value.trim()) || [];
      items = [];
      list.innerHTML = groups
        .filter(function (group) {
          return group.items && group.items.length;
        })
        .map(function (group) {
          return (
            '<li class="cmdk-group" role="presentation">' +
            escapeHtml(group.label) +
            "</li>" +
            group.items
              .map(function (item) {
                const index = items.push(item) - 1;
                return (
                  '<li class="cmdk-item" role="option" id="cmdk-item-' +
                  index +
                  '" data-index="' +
                  index +
                  '"><span class="cmdk-item-icon">' +
                  icon(item.icon || "arrow-right") +
                  '</span><span class="cmdk-item-copy"><strong>' +
                  escapeHtml(item.title) +
                  "</strong>" +
                  (item.subtitle ? "<span>" + escapeHtml(item.subtitle) + "</span>" : "") +
                  "</span>" +
                  (item.meta || "") +
                  "</li>"
                );
              })
              .join("")
          );
        })
        .join("");
      if (items.length === 0) {
        list.innerHTML = '<li class="cmdk-empty">No matches. Try a report ID, road, or name.</li>';
      } else {
        setActive(0);
      }
    }

    function run(index) {
      const item = items[index];
      if (!item) {
        return;
      }
      closePalette();
      window.setTimeout(function () {
        item.run();
      }, 0);
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closePalette();
      } else if (event.key === "ArrowDown" && items.length) {
        event.preventDefault();
        setActive((active + 1) % items.length);
      } else if (event.key === "ArrowUp" && items.length) {
        event.preventDefault();
        setActive((active - 1 + items.length) % items.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        run(active);
      } else if (event.key === "Tab") {
        event.preventDefault();
        input.focus();
      }
    }

    input.addEventListener("input", render);
    list.addEventListener("mousemove", function (event) {
      const item = event.target.closest(".cmdk-item");
      if (item && Number(item.dataset.index) !== active) {
        setActive(Number(item.dataset.index));
      }
    });
    list.addEventListener("click", function (event) {
      const item = event.target.closest(".cmdk-item");
      if (item) {
        run(Number(item.dataset.index));
      }
    });
    backdrop.addEventListener("pointerdown", function (event) {
      if (event.target === backdrop) {
        closePalette();
      }
    });

    palette = {
      backdrop: backdrop,
      onKeydown: onKeydown,
      opener: opener || document.activeElement,
      restoreInert: ui() ? ui().setBackgroundInert([backdrop]) : function () {},
    };
    document.addEventListener("keydown", onKeydown, true);
    render();
    input.focus();
  }

  document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && commandSource) {
      event.preventDefault();
      if (palette) {
        closePalette();
      } else {
        openPalette();
      }
    }
  });

  document.addEventListener("click", function (event) {
    const trigger = event.target.closest("[data-cmdk-open]");
    if (trigger) {
      openPalette(trigger);
    }
  });

  document.querySelectorAll("[data-kbd-mod]").forEach(function (element) {
    element.textContent = isMac ? "⌘" : "Ctrl";
  });

  /* ---------- Notifications ---------- */

  let notificationSource = null;
  let notificationKey = null;
  let notificationPopover = null;

  function lastSeen() {
    return Number(readPref(notificationKey) || 0);
  }

  function refreshNotifications() {
    const button = document.querySelector("[data-notif-toggle]");
    if (!button || !notificationSource) {
      return;
    }
    const seen = lastSeen();
    const unread = notificationSource().filter(function (item) {
      return Date.parse(item.at) > seen;
    }).length;
    let dot = button.querySelector(".badge-dot");
    if (unread && !dot) {
      dot = document.createElement("span");
      dot.className = "badge-dot";
      button.appendChild(dot);
    } else if (!unread && dot) {
      dot.remove();
    }
    button.setAttribute("aria-label", unread ? "Notifications, " + unread + " new" : "Notifications");
  }

  function renderNotifications() {
    const seen = lastSeen();
    const items = notificationSource().slice(0, 25);
    notificationPopover.innerHTML =
      '<div class="notif-head"><strong>Activity</strong><span class="muted text-sm">' +
      escapeHtml(items.length ? "Latest updates" : "") +
      "</span></div>" +
      (items.length
        ? '<ul class="notif-list">' +
          items
            .map(function (item, index) {
              return (
                '<li><button class="notif-item' +
                (Date.parse(item.at) > seen ? " is-unread" : "") +
                '" type="button" data-notif-index="' +
                index +
                '"><span class="timeline-dot status-' +
                escapeHtml(item.status || "submitted") +
                '" aria-hidden="true"></span><span class="notif-copy"><strong>' +
                escapeHtml(item.title) +
                "</strong>" +
                escapeHtml(item.description || "") +
                "<span>" +
                escapeHtml(item.meta || "") +
                "</span></span></button></li>"
              );
            })
            .join("") +
          "</ul>"
        : '<p class="notif-empty">You are all caught up.</p>');
    notificationPopover._items = items;
  }

  function setNotificationSource(source, userKey) {
    notificationSource = source;
    notificationKey = "resqroad-seen-" + (userKey || "user");
    const button = document.querySelector("[data-notif-toggle]");
    if (!button) {
      return;
    }
    if (!notificationPopover) {
      notificationPopover = document.createElement("div");
      notificationPopover.className = "popover notif-popover";
      notificationPopover.id = "notifications-popover";
      notificationPopover.hidden = true;
      document.body.appendChild(notificationPopover);
      button.setAttribute("aria-haspopup", "true");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", notificationPopover.id);
      button.addEventListener("click", function () {
        if (openPopover && openPopover.popover === notificationPopover) {
          closePopover(false);
          return;
        }
        renderNotifications();
        showPopover(button, notificationPopover, function () {
          writePref(notificationKey, String(Date.now()));
          refreshNotifications();
        });
      });
      notificationPopover.addEventListener("click", function (event) {
        const item = event.target.closest("[data-notif-index]");
        if (!item) {
          return;
        }
        const entry = notificationPopover._items[Number(item.dataset.notifIndex)];
        closePopover(false);
        if (entry && entry.run) {
          entry.run();
        }
      });
    }
    refreshNotifications();
  }

  document.querySelectorAll("[data-current-year]").forEach(function (element) {
    element.textContent = String(new Date().getFullYear());
  });

  setTheme(currentTheme(), false);

  window.RoadWatchShell = {
    setTheme: setTheme,
    currentTheme: currentTheme,
    closeNav: closeNav,
    closePopover: closePopover,
    setCommandSource: setCommandSource,
    openPalette: openPalette,
    setNotificationSource: setNotificationSource,
    refreshNotifications: refreshNotifications,
  };
})();
