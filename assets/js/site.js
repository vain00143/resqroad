/* Public site chrome: the header that turns solid on scroll, the mobile menu,
   and links that adapt to whoever is signed in. */
(function () {
  "use strict";

  const auth = window.RoadWatchAuth;
  const header = document.querySelector(".site-header");

  if (header) {
    const transparent = header.hasAttribute("data-transparent");
    const menuButton = header.querySelector("[data-site-menu]");
    const mobileNav = document.getElementById("mobile-nav");

    function sync() {
      const menuOpen = mobileNav && !mobileNav.hidden;
      header.classList.toggle("is-solid", !transparent || window.scrollY > 24 || menuOpen);
    }

    if (menuButton && mobileNav) {
      menuButton.addEventListener("click", function () {
        mobileNav.hidden = !mobileNav.hidden;
        menuButton.setAttribute("aria-expanded", String(!mobileNav.hidden));
        menuButton.setAttribute("aria-label", mobileNav.hidden ? "Open menu" : "Close menu");
        menuButton.innerHTML = window.RoadWatchIcons.svg(mobileNav.hidden ? "menu" : "x");
        sync();
      });
      mobileNav.addEventListener("click", function (event) {
        if (event.target.closest("a")) {
          mobileNav.hidden = true;
          menuButton.setAttribute("aria-expanded", "false");
          menuButton.innerHTML = window.RoadWatchIcons.svg("menu");
          sync();
        }
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !mobileNav.hidden) {
          menuButton.click();
          menuButton.focus();
        }
      });
      window.matchMedia("(min-width: 961px)").addEventListener("change", function (event) {
        if (event.matches && !mobileNav.hidden) {
          menuButton.click();
        }
      });
    }

    window.addEventListener("scroll", sync, { passive: true });
    sync();
  }

  /* Highlights the menu link of the section being read (e.g. Live map) as
     the page scrolls. A clicked link stays highlighted while the page
     scrolls to it, so the highlight doesn't flicker through the sections in
     between. */
  const sectionLinks = Array.from(document.querySelectorAll('.site-nav a[href^="#"], .mobile-nav a[href^="#"]')).filter(
    function (link) {
      return link.hash.length > 1 && document.getElementById(link.hash.slice(1));
    },
  );
  if (header && sectionLinks.length) {
    const sections = Array.from(
      new Set(
        sectionLinks.map(function (link) {
          return link.hash.slice(1);
        }),
      ),
    ).map(function (id) {
      return document.getElementById(id);
    });
    let lockedId = null;
    let idleTimer = null;

    function setActive(id) {
      sectionLinks.forEach(function (link) {
        const active = link.hash.slice(1) === id;
        link.classList.toggle("is-active", active);
        if (active) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    // The section crossing a line just under the header, if any.
    function currentSection() {
      const line = header.offsetHeight + Math.min(window.innerHeight * 0.3, 220);
      const section = sections.find(function (item) {
        const box = item.getBoundingClientRect();
        return box.top <= line && box.bottom > line;
      });
      return section ? section.id : null;
    }

    function update() {
      setActive(lockedId || currentSection());
    }

    window.addEventListener(
      "scroll",
      function () {
        if (lockedId) {
          window.clearTimeout(idleTimer);
          idleTimer = window.setTimeout(function () {
            lockedId = null;
            update();
          }, 160);
        }
        update();
      },
      { passive: true },
    );
    window.addEventListener("resize", update);
    sectionLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        lockedId = link.hash.slice(1);
        setActive(lockedId);
        // If the page doesn't need to scroll, release the lock right away.
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(function () {
          lockedId = null;
          update();
        }, 900);
      });
    });
    update();
  }

  function applyUser() {
    const user = auth ? auth.readUser() : null;
    // Signed-in visitors see a link back to their workspace instead of "Sign in".
    document.querySelectorAll("[data-signed-in]").forEach(function (element) {
      element.hidden = !user;
    });
    document.querySelectorAll("[data-signed-out]").forEach(function (element) {
      element.hidden = Boolean(user);
    });
    document.querySelectorAll("[data-workspace-link]").forEach(function (link) {
      if (!user) {
        return;
      }
      link.href = auth.workspaceFor(user);
      const label = link.querySelector("[data-workspace-label]");
      if (label) {
        label.textContent = user.role === "citizen" ? "My reports" : "Open workspace";
      }
    });
    // "Report a problem" goes straight to the form for citizens; everyone else
    // signs in (or registers) first.
    document.querySelectorAll("[data-report-link]").forEach(function (link) {
      link.href = user && user.role === "citizen" ? "citizen.html#report" : "login.html?next=report";
    });
  }

  if (window.RoadWatchStore) {
    window.RoadWatchStore.ready().then(applyUser);
  }
})();
