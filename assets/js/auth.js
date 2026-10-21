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
    return user;
  }

  let signingOut = false;

  async function signOut(redirectTo) {
    signingOut = true;
    try {
      await backend().signOut();
    } finally {
      window.location.assign(redirectTo || loginPage);
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

  // If the account is signed out or deactivated elsewhere while a protected
  // page is open, go back to the sign-in page.
  const requiredRole = document.body && document.body.dataset.requiredRole;
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
})();
