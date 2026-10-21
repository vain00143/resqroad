/* Sign-in page. Everyone signs in here; the account's role decides which
   workspace opens. Visiting while already signed in goes straight there. */
(function () {
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
    console.error("ResQRoad sign-in failed.", error);
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
  }

  function destination(user) {
    if (user.role === "citizen" && wantsToReport) {
      return "citizen.html#report";
    }
    return auth.workspaceFor(user);
  }

  try {
    const currentUser = auth.readUser();
    if (currentUser) {
      window.location.replace(destination(currentUser));
      return;
    }
  } catch (error) {
    showError(error);
    submitButton.disabled = true;
  }

  if (wantsToReport) {
    notice.innerHTML =
      ui.icon("map-pin") + "<span>Sign in to report a road problem, or create a free resident account.</span>";
    notice.hidden = false;
    document.querySelector("#register-link").href = "register.html?next=report";
  } else if (params.get("deactivated") === "1") {
    errorMessage.textContent = "This account has been deactivated. Contact the Road Maintenance Office to reactivate it.";
    errorMessage.hidden = false;
  }

  passwordToggle.addEventListener("click", function () {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    passwordToggle.innerHTML = ui.icon(isHidden ? "eye-off" : "eye");
    passwordToggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    passwordToggle.setAttribute("aria-pressed", String(isHidden));
  });

  form.addEventListener("submit", function (event) {
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
    // A short pause so the button's loading state is visible.
    window.setTimeout(function () {
      try {
        const user = auth.signIn(emailInput.value, passwordInput.value);
        ui.flash("Welcome back, " + user.name.split(" ")[0] + ".", "success");
        window.location.assign(destination(user));
      } catch (error) {
        submitButton.classList.remove("is-loading");
        passwordInput.setAttribute("aria-invalid", "true");
        passwordInput.select();
        showError(error);
      }
    }, 280);
  });
})();
