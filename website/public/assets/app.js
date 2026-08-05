const page = document.body.dataset.page;

async function responseMessage(response, fallback) {
  try {
    const body = await response.json();
    return body?.error?.message || fallback;
  } catch {
    return fallback;
  }
}

async function loadSession() {
  const response = await fetch("/api/auth/session", { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  return response.json();
}

if (page === "login") {
  loadSession().then((session) => {
    if (session) window.location.replace("/dashboard");
  }).catch(() => undefined);

  const form = document.querySelector("#login-form");
  const email = document.querySelector("#email");
  const password = document.querySelector("#password");
  const alert = document.querySelector("#login-error");
  const submit = form.querySelector("button[type='submit']");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    alert.hidden = true;
    document.querySelector("#email-error").textContent = "";
    document.querySelector("#password-error").textContent = "";

    let valid = true;
    if (!email.validity.valid) {
      document.querySelector("#email-error").textContent = "Enter a valid email address.";
      valid = false;
    }
    if (!password.value) {
      document.querySelector("#password-error").textContent = "Enter your password.";
      valid = false;
    }
    if (!valid) return;

    submit.disabled = true;
    submit.textContent = "Signing in…";
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Phoenix-Web-Session": "1" },
        body: JSON.stringify({ email: email.value.trim(), password: password.value }),
      });
      password.value = "";
      if (!response.ok) {
        alert.textContent = await responseMessage(response, "Sign-in failed. Please try again.");
        alert.hidden = false;
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      password.value = "";
      alert.textContent = "Phoenix BOS is currently unreachable. Please try again.";
      alert.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  });
}

if (page === "dashboard") {
  const logout = document.querySelector("#logout-button");

  Promise.all([
    loadSession(),
    fetch("/health", { headers: { Accept: "application/json" } }).then((response) => response.ok ? response.json() : null).catch(() => null),
  ]).then(([session, health]) => {
    if (!session) {
      window.location.replace("/login");
      return;
    }
    const { user } = session;
    const firstName = user.displayName.trim().split(/\s+/)[0] || user.displayName;
    document.querySelector("#user-name").textContent = user.displayName;
    document.querySelector("#user-role").textContent = user.role;
    document.querySelector("#user-avatar").textContent = user.displayName.charAt(0).toUpperCase();
    document.querySelector("#welcome-name").textContent = firstName;
    document.querySelector("#account-name").textContent = user.displayName;
    document.querySelector("#account-email").textContent = `${user.email} · ${user.role}`;

    const healthy = health?.status === "ok";
    document.querySelector("#backend-status").textContent = healthy ? "Operational" : "Unavailable";
    document.querySelector("#backend-detail").textContent = healthy ? "API and database are ready" : "Health check did not succeed";
  }).catch(() => window.location.replace("/login"));

  logout.addEventListener("click", async () => {
    logout.disabled = true;
    logout.textContent = "Logging out…";
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" } });
    } finally {
      window.location.replace("/login");
    }
  });

  document.querySelectorAll("[data-coming-soon]").forEach((item) => item.addEventListener("click", () => {
    const notice = document.querySelector("#coming-soon");
    document.querySelector("#coming-soon-title").textContent = `${item.dataset.comingSoon} — coming soon`;
    notice.hidden = false;
    notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }));

  const menu = document.querySelector("#menu-button");
  const sidebar = document.querySelector("#sidebar");
  menu.addEventListener("click", () => {
    const open = sidebar.classList.toggle("open");
    menu.setAttribute("aria-expanded", String(open));
  });
}
