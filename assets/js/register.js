/* Resident registration. Creates a Firebase account plus a resident profile,
   signs the person in, and opens the citizen portal (straight to the report
   form when they came to report). */
(async function () {
  "use strict";

  const store = window.RoadWatchStore;
  const auth = window.RoadWatchAuth;
  const ui = window.RoadWatchUI;
  const form = document.querySelector("#register-form");
  const errorMessage = document.querySelector("#register-error");
  const submitButton = form.querySelector('button[type="submit"]');
  const passwordInput = form.elements.namedItem("password");
  const confirmInput = form.elements.namedItem("confirm");
  const strength = document.querySelector("#password-strength");
  const wantsToReport = new URLSearchParams(window.location.search).get("next") === "report";
  let registering = false;

  if (wantsToReport) {
    document.querySelector("#login-link").href = "login.html?next=report";
  }

  function showError(message, field) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.focus();
    }
  }

  function score(password) {
    let points = 0;
    if (password.length >= 8) {
      points += 1;
    }
    if (/[A-Za-z]/.test(password) && /\d/.test(password)) {
      points += 1;
    }
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) {
      points += 1;
    }
    if (password.length >= 12 || /[^A-Za-z0-9]/.test(password)) {
      points += 1;
    }
    return password ? Math.max(1, points) : 0;
  }

  passwordInput.addEventListener("input", function () {
    strength.dataset.score = String(score(passwordInput.value));
  });

  form.querySelector("[data-toggle-password]").addEventListener("click", function (event) {
    const button = event.currentTarget;
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    confirmInput.type = passwordInput.type;
    button.innerHTML = ui.icon(isHidden ? "eye-off" : "eye");
    button.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    button.setAttribute("aria-pressed", String(isHidden));
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (registering) {
      return;
    }
    errorMessage.hidden = true;
    form.querySelectorAll("[aria-invalid]").forEach(function (field) {
      field.removeAttribute("aria-invalid");
    });

    const name = form.elements.namedItem("name");
    const email = form.elements.namedItem("email");
    if (!name.value.trim()) {
      showError("Enter your full name.", name);
      return;
    }
    if (!email.value.trim()) {
      showError("Enter your email address.", email);
      return;
    }
    if (passwordInput.value !== confirmInput.value) {
      showError("The passwords don't match.", confirmInput);
      return;
    }

    registering = true;
    submitButton.classList.add("is-loading");
    try {
      const citizen = await store.registerCitizen({
        name: name.value,
        email: email.value,
        password: passwordInput.value,
      });
      ui.flash("Welcome to ResQRoad, " + citizen.name.split(" ")[0] + ". Your account is ready.", "success");
      window.location.assign(wantsToReport ? "citizen.html#report" : "citizen.html");
    } catch (error) {
      registering = false;
      submitButton.classList.remove("is-loading");
      const field = /email/i.test(error.message)
        ? email
        : /password|characters/i.test(error.message)
          ? passwordInput
          : /name/i.test(error.message)
            ? name
            : null;
      showError(error.message, field);
    }
  });

  // Already signed in: go to that account's workspace instead.
  await store.ready();
  const currentUser = auth.readUser();
  if (currentUser && !registering) {
    window.location.replace(auth.workspaceFor(currentUser));
  }
})();
