/* Sign-in page. Everyone signs in here; the account's role decides which
   workspace opens. Visiting while already signed in goes straight there. */
(async function () {
  "use strict";

  const auth = window.RoadWatchAuth;
  const ui = window.RoadWatchUI;
  const form = document.querySelector("#login-form");
  const errorMessage = document.querySelector("#login-error");
  const notice = document.querySelector("#login-notice");
  const submitButton = form.querySelector('button[type="submit"]');
  const emailInput = form.elements.namedItem("email");
  const passwordInput = form.elements.namedItem("password");
  const passwordToggle = form.querySelector("[data-toggle-password]");
  const params = new URLSearchParams(window.location.search);
  const wantsToReport = params.get("next") === "report";

  function showError(error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
  }

  function destination(user) {
    if (user.role === "citizen" && wantsToReport) {
      return "citizen.html#report";
    }
    return auth.workspaceFor(user);
  }

  passwordToggle.addEventListener("click", function () {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    passwordToggle.innerHTML = ui.icon(isHidden ? "eye-off" : "eye");
    passwordToggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    passwordToggle.setAttribute("aria-pressed", String(isHidden));
  });

  if (wantsToReport) {
    notice.innerHTML =
      ui.icon("map-pin") + "<span>Sign in to report a road problem, or create a free resident account.</span>";
    notice.hidden = false;
    document.querySelector("#register-link").href = "register.html?next=report";
  } else if (params.get("signedout") === "1") {
    notice.innerHTML =
      ui.icon("info") +
      "<span>You were signed out. If your account was deactivated, contact the Road Maintenance Office.</span>";
    notice.hidden = false;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    errorMessage.hidden = true;
    emailInput.removeAttribute("aria-invalid");
    passwordInput.removeAttribute("aria-invalid");

    if (!emailInput.value.trim()) {
      emailInput.setAttribute("aria-invalid", "true");
      emailInput.focus();
      showError(new Error("Enter your email address."));
      return;
    }
    if (!passwordInput.value) {
      passwordInput.setAttribute("aria-invalid", "true");
      passwordInput.focus();
      showError(new Error("Enter your password."));
      return;
    }

    submitButton.classList.add("is-loading");
    try {
      const user = await auth.signIn(emailInput.value, passwordInput.value);
      ui.flash("Welcome back, " + user.name.split(" ")[0] + ".", "success");
      window.location.assign(destination(user));
    } catch (error) {
      submitButton.classList.remove("is-loading");
      passwordInput.setAttribute("aria-invalid", "true");
      passwordInput.select();
      showError(error);
    }
  });

  // Already signed in: go straight to the right workspace.
  await window.RoadWatchStore.ready();
  const currentUser = auth.readUser();
  if (currentUser) {
    window.location.replace(destination(currentUser));
  }
})();
