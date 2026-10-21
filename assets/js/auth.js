/* Mock sign-in for the ResQRoad prototype. One sign-in form serves everyone:
   the email decides whether the account is the administrator, a maintenance
   crew member, or a citizen. The session lives in this tab's sessionStorage.
   These are demo credentials, not real authentication. */
(function () {
  "use strict";

  const storageKey = "roadwatch-demo-user";
  const demoAccounts = {
    admin: { email: "admin@resqroad.ph", password: "admin123", name: "Admin User" },
    maintenance: { password: "crew123" },
  };
  const workspaces = {
    admin: "admin.html",
    maintenance: "maintenance.html",
    citizen: "citizen.html",
  };
  const loginPage = "login.html";

  function readUser() {
    let storedUser = null;
    try {
      storedUser = sessionStorage.getItem(storageKey);
    } catch (error) {
      console.error("Could not read the ResQRoad sign-in.", error);
      return null;
    }
    if (!storedUser) {
      return null;
    }

    try {
      const user = JSON.parse(storedUser);
      if (!user || !Object.prototype.hasOwnProperty.call(workspaces, user.role) || typeof user.name !== "string") {
        throw new Error("The saved sign-in details have an unexpected format.");
      }
      return user;
    } catch (error) {
      console.error("Could not read the ResQRoad sign-in.", error);
      sessionStorage.removeItem(storageKey);
      return null;
    }
  }

  function saveUser(user) {
    sessionStorage.setItem(storageKey, JSON.stringify(user));
    return user;
  }

  function signInAdmin(email, password) {
    if (email.trim().toLowerCase() !== demoAccounts.admin.email || password !== demoAccounts.admin.password) {
      throw new Error("Incorrect email or password.");
    }
    return saveUser({ role: "admin", name: demoAccounts.admin.name, email: demoAccounts.admin.email });
  }

  function signIn(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) {
      throw new Error("Enter your email and password.");
    }
    if (normalizedEmail === demoAccounts.admin.email) {
      return signInAdmin(normalizedEmail, password);
    }

    const state = window.RoadWatchStore.getState();
    const person = state.personnel.find(function (item) {
      return item.email && item.email.toLowerCase() === normalizedEmail;
    });
    if (person) {
      if (password !== demoAccounts.maintenance.password) {
        throw new Error("Incorrect email or password.");
      }
      return saveUser({
        role: "maintenance",
        userId: person.id,
        name: person.name,
        team: person.team,
        email: person.email,
      });
    }

    const citizen = state.citizens.find(function (item) {
      return item.email.toLowerCase() === normalizedEmail;
    });
    if (citizen && citizen.password === password) {
      if (citizen.active === false) {
        throw new Error(
          "This account has been deactivated. Contact the Road Maintenance Office to reactivate it.",
        );
      }
      return signInCitizen(citizen);
    }

    throw new Error("Incorrect email or password.");
  }

  function signInCitizen(citizen) {
    return saveUser({ role: "citizen", userId: citizen.id, name: citizen.name, email: citizen.email });
  }

  function workspaceFor(user) {
    return user ? workspaces[user.role] : loginPage;
  }

  // Returns the signed-in user for this page, or sends the visitor to sign in.
  function requireRole(role, redirectTo) {
    const target = redirectTo || loginPage;
    const user = readUser();

    if (!user || user.role !== role) {
      window.location.replace(target + (target.indexOf("?") < 0 ? "?next=" + encodeURIComponent(workspaces[role]) : ""));
      return null;
    }

    let state;
    try {
      state = window.RoadWatchStore.getState();
    } catch (error) {
      console.error("Could not check the ResQRoad sign-in.", error);
      return user;
    }

    if (role === "maintenance") {
      const person = state.personnel.find(function (item) {
        return item.id === user.userId;
      });
      if (!person) {
        sessionStorage.removeItem(storageKey);
        window.location.replace(target);
        return null;
      }
      user.name = person.name;
      user.team = person.team;
    }
    if (role === "citizen") {
      const citizen = state.citizens.find(function (item) {
        return item.id === user.userId;
      });
      if (!citizen || citizen.active === false) {
        sessionStorage.removeItem(storageKey);
        window.location.replace(target + "?deactivated=" + (citizen ? "1" : "0"));
        return null;
      }
      user.name = citizen.name;
      user.email = citizen.email;
    }
    return user;
  }

  function signOut(redirectTo) {
    sessionStorage.removeItem(storageKey);
    window.location.assign(redirectTo || loginPage);
  }

  window.RoadWatchAuth = {
    readUser: readUser,
    signIn: signIn,
    signInCitizen: signInCitizen,
    requireRole: requireRole,
    signOut: signOut,
    workspaceFor: workspaceFor,
    workspaces: workspaces,
    loginPage: loginPage,
  };

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
