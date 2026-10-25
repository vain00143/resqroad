/* Sign-in for ResQRoad, checked by the ResQRoad server. One sign-in form
   serves everyone: the account's role in the database decides whether it is
   the administrator, a maintenance crew member, or a resident. */
(function () {
  "use strict";

  const workspaces = {
    admin: "admin.html",
    maintenance: "maintenance.html",
    citizen: "citizen.html",
  };
  const loginPage = "login.html";
  // The role a workspace page is for (<body data-required-role>).
  const requiredRole = document.body && document.body.dataset.requiredRole;

  function backend() {
    return window.RoadWatchBackend;
  }

  // The signed-in user, available after RoadWatchStore.ready() resolves.
  function readUser() {
    return backend() ? backend().currentUser() : null;
  }

  function signIn(email, password) {
    return backend().signIn(email, password);
  }

  function workspaceFor(user) {
    return user ? workspaces[user.role] : loginPage;
  }

  // Resolves to the signed-in user for this page, or sends the visitor to
  // sign in and resolves to null.
  async function requireRole(role, redirectTo) {
    const target = redirectTo || loginPage;
    await window.RoadWatchStore.ready();
    const user = readUser();
    if (!user || user.role !== role) {
      window.location.replace(target + "?next=" + encodeURIComponent(workspaces[role]));
      return null;
    }
    // The workspace stays hidden until the sign-in is confirmed (see
    // [data-booting] in app.css), so its empty frame never flashes on screen.
    document.body.removeAttribute("data-booting");
    return user;
  }

  let signingOut = false;

  // Ends the session, then leaves the workspace without keeping it in the
  // browser history, so Back can't bring it up again.
  async function signOut(redirectTo) {
    signingOut = true;
    if (requiredRole) {
      document.body.setAttribute("data-booting", "");
    }
    try {
      await backend().signOut();
    } finally {
      window.location.replace(redirectTo || loginPage);
    }
  }

  window.RoadWatchAuth = {
    readUser: readUser,
    signIn: signIn,
    requireRole: requireRole,
    signOut: signOut,
    workspaceFor: workspaceFor,
    workspaces: workspaces,
    loginPage: loginPage,
  };

  // A workspace the browser restores from its back/forward cache checks the
  // sign-in with the server again before anything is shown. (The server
  // also marks workspaces as never cached and sends signed-out visitors to
  // the sign-in page.)
  window.addEventListener("pageshow", function (event) {
    if (!event.persisted || !requiredRole) {
      return;
    }
    document.body.setAttribute("data-booting", "");
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then(function (response) {
        return response.json();
      })
      .then(function (body) {
        if (body.user && body.user.role === requiredRole) {
          document.body.removeAttribute("data-booting");
        } else {
          window.location.replace(loginPage + "?next=" + encodeURIComponent(workspaces[requiredRole]));
        }
      })
      .catch(function () {
        window.location.reload();
      });
  });

  // If the account is signed out or deactivated elsewhere while a protected
  // page is open, go back to the sign-in page.
  if (requiredRole && window.RoadWatchStore) {
    window.RoadWatchStore.ready().then(function () {
      window.RoadWatchStore.onExternalChange(function () {
        const user = readUser();
        if (!signingOut && (!user || user.role !== requiredRole)) {
          window.location.replace(loginPage + "?signedout=1");
        }
      });
    });
  }

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-sign-out]");
    if (!button) {
      return;
    }
    event.preventDefault();
    const destination = button.dataset.signOut || loginPage;
    const ui = window.RoadWatchUI;
    if (!ui || !ui.confirm) {
      signOut(destination);
      return;
    }
    ui.confirm({
      kicker: "Account",
      title: "Log out of ResQRoad?",
      message: "You'll need to sign in again to get back to your workspace.",
      confirmLabel: "Log out",
      icon: "log-out",
      opener: button,
    }).then(function (confirmed) {
      if (confirmed) {
        signOut(destination);
      }
    });
  });

  // "Change password" in the account menu, for every signed-in person.
  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-change-password]");
    const ui = window.RoadWatchUI;
    if (!button || !ui || !ui.form) {
      return;
    }
    event.preventDefault();
    ui.form({
      kicker: "Account",
      title: "Change your password",
      message: "You'll stay signed in here. Your other devices will be signed out.",
      icon: "lock",
      confirmLabel: "Change password",
      opener: button,
      fields: [
        { name: "current", label: "Current password", type: "password", autocomplete: "current-password" },
        {
          name: "next",
          label: "New password",
          type: "password",
          autocomplete: "new-password",
          hint: "At least 8 characters with a letter and a number.",
        },
        { name: "confirm", label: "Confirm new password", type: "password", autocomplete: "new-password" },
      ],
      submit: async function (values) {
        if (values.next !== values.confirm) {
          throw new Error("The new passwords don't match.");
        }
        await backend().changePassword(values.current, values.next);
        return true;
      },
    }).then(function (changed) {
      if (changed) {
        ui.showMessage("Your password was changed. Other devices were signed out.", "success");
      }
    });
  });
})();
