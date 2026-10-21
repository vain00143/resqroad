/* Animated select menus. The native <select> stays in the page as the source
   of truth for values and change events; the button and list only drive it. */
(function () {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const buttons = new WeakMap();
  let openMenu = null;
  let menuCount = 0;

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
    window.setTimeout(finish, 250);
  }

  function syncSelect(select) {
    const button = buttons.get(select);
    if (!button) {
      return;
    }
    const option = select.options[select.selectedIndex];
    button.querySelector(".select-menu-value").textContent = option ? option.text : "";
    button.classList.toggle("is-placeholder", !option || option.value === "");
    button.disabled = select.disabled;
  }

  function syncAllSelects() {
    document.querySelectorAll("select[data-select-menu]").forEach(syncSelect);
  }

  function enhanceSelect(select) {
    if (select.dataset.selectMenu || select.multiple || select.hasAttribute("data-native")) {
      return;
    }
    select.dataset.selectMenu = "true";

    const wrapper = document.createElement("span");
    wrapper.className = "select-menu";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "select-menu-button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    if (select.id) {
      button.id = select.id + "-button";
      const label = document.querySelector('label[for="' + CSS.escape(select.id) + '"]');
      if (label) {
        label.htmlFor = button.id;
      }
    }
    if (select.hasAttribute("aria-label")) {
      button.setAttribute("aria-label", select.getAttribute("aria-label"));
    }
    button.innerHTML =
      '<span class="select-menu-value"></span>' +
      '<svg class="select-menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

    // The button comes first so a wrapping <label> targets it.
    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(button, select);
    select.classList.add("select-menu-native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    buttons.set(select, button);
    syncSelect(select);

    button.addEventListener("click", function () {
      if (openMenu && openMenu.select === select) {
        closeMenu(true);
      } else {
        openSelect(select);
      }
    });
    button.addEventListener("keydown", function (event) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openSelect(select);
      }
    });
    select.addEventListener("change", function () {
      syncSelect(select);
    });
  }

  function positionMenu() {
    if (!openMenu) {
      return;
    }
    const { button, list } = openMenu;
    if (!button.isConnected) {
      closeMenu(false);
      return;
    }
    const rect = button.getBoundingClientRect();
    const gap = 6;
    list.style.minWidth = rect.width + "px";
    list.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - list.offsetWidth - 8)) + "px";
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const placeAbove = spaceBelow < list.offsetHeight && rect.top > spaceBelow;
    list.classList.toggle("is-above", placeAbove);
    list.style.top = (placeAbove ? rect.top - gap - list.offsetHeight : rect.bottom + gap) + "px";
  }

  function setActive(index) {
    const { list } = openMenu;
    const options = list.querySelectorAll('[role="option"]');
    options.forEach(function (option, optionIndex) {
      option.classList.toggle("is-active", optionIndex === index);
    });
    openMenu.activeIndex = index;
    if (options[index]) {
      list.setAttribute("aria-activedescendant", options[index].id);
      options[index].scrollIntoView({ block: "nearest" });
    }
  }

  function moveActive(step) {
    const { select, activeIndex } = openMenu;
    let index = activeIndex;
    for (let count = 0; count < select.options.length; count += 1) {
      index = (index + step + select.options.length) % select.options.length;
      if (!select.options[index].disabled) {
        setActive(index);
        return;
      }
    }
  }

  function choose(index) {
    const { select, button } = openMenu;
    const option = select.options[index];
    if (!option || option.disabled) {
      return;
    }
    if (select.selectedIndex !== index) {
      select.selectedIndex = index;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    syncSelect(select);
    closeMenu(false);
    button.focus();
  }

  function openSelect(select) {
    closeMenu(false);
    const button = buttons.get(select);
    menuCount += 1;
    const list = document.createElement("ul");
    list.className = "select-menu-list";
    list.id = "select-menu-" + menuCount;
    list.setAttribute("role", "listbox");
    list.tabIndex = -1;
    if (button.getAttribute("aria-label")) {
      list.setAttribute("aria-label", button.getAttribute("aria-label"));
    }
    Array.from(select.options).forEach(function (option, index) {
      const item = document.createElement("li");
      item.id = list.id + "-" + index;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === select.selectedIndex));
      item.dataset.index = String(index);
      item.innerHTML =
        '<span class="select-menu-option-label"></span>' +
        '<svg class="select-menu-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
      item.firstChild.textContent = option.text;
      if (option.disabled) {
        item.setAttribute("aria-disabled", "true");
      }
      list.appendChild(item);
    });

    list.addEventListener("mousedown", function (event) {
      event.preventDefault();
    });
    list.addEventListener("mousemove", function (event) {
      const item = event.target.closest('[role="option"]');
      if (item && Number(item.dataset.index) !== openMenu.activeIndex) {
        setActive(Number(item.dataset.index));
      }
    });
    list.addEventListener("click", function (event) {
      const item = event.target.closest('[role="option"]');
      if (item) {
        choose(Number(item.dataset.index));
      }
    });
    list.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActive(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        setActive(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setActive(select.options.length - 1);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose(openMenu.activeIndex);
      } else if (event.key === "Escape") {
        // Keep Escape from also closing the drawer or dialog behind the menu.
        event.preventDefault();
        event.stopPropagation();
        closeMenu(true);
      } else if (event.key === "Tab") {
        closeMenu(false);
      } else if (event.key.length === 1) {
        const letter = event.key.toLowerCase();
        const match = Array.from(select.options).findIndex(function (option, index) {
          return index > openMenu.activeIndex && option.text.toLowerCase().startsWith(letter);
        });
        const first = Array.from(select.options).findIndex(function (option) {
          return option.text.toLowerCase().startsWith(letter);
        });
        if (match >= 0 || first >= 0) {
          setActive(match >= 0 ? match : first);
        }
      }
    });

    document.body.appendChild(list);
    openMenu = { select: select, button: button, list: list, activeIndex: Math.max(0, select.selectedIndex) };
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", list.id);
    positionMenu();
    setActive(openMenu.activeIndex);
    list.focus({ preventScroll: true });
  }

  function closeMenu(restoreFocus) {
    if (!openMenu) {
      return;
    }
    const { button, list } = openMenu;
    openMenu = null;
    button.setAttribute("aria-expanded", "false");
    button.removeAttribute("aria-controls");
    list.classList.add("is-closing");
    afterAnimation(list, function () {
      list.remove();
    });
    if (restoreFocus && button.isConnected) {
      button.focus();
    }
  }

  document.addEventListener("pointerdown", function (event) {
    if (openMenu && !openMenu.list.contains(event.target) && !openMenu.button.contains(event.target)) {
      closeMenu(false);
    }
  });
  document.addEventListener(
    "scroll",
    function (event) {
      if (openMenu && !openMenu.list.contains(event.target)) {
        positionMenu();
      }
    },
    true,
  );
  window.addEventListener("resize", positionMenu);
  // Page scripts sometimes set a select's value directly, which fires no event;
  // re-read every select after each click so the buttons never show stale text.
  document.addEventListener(
    "click",
    function () {
      window.setTimeout(syncAllSelects, 0);
    },
    true,
  );

  document.querySelectorAll("select").forEach(enhanceSelect);
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return;
        }
        if (node.matches("select")) {
          enhanceSelect(node);
        }
        node.querySelectorAll("select").forEach(enhanceSelect);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  window.RoadWatchMenus = { sync: syncAllSelects };
})();
