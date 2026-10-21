/* Public site chrome: the header that turns solid on scroll, the mobile menu,
   and links that adapt to whoever is signed in. */
(function () {
  "use strict";

  const auth = window.RoadWatchAuth;
  const header = document.querySelector(".site-header");
  const user = auth ? auth.readUser() : null;

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
})();
