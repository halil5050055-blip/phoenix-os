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

function setupAuthenticatedShell(session) {
  const { user } = session;
  const userName = document.querySelector("#user-name");
  const userRole = document.querySelector("#user-role");
  const userAvatar = document.querySelector("#user-avatar");
  if (userName) userName.textContent = user.displayName;
  if (userRole) userRole.textContent = user.role;
  if (userAvatar) userAvatar.textContent = user.displayName.charAt(0).toUpperCase();

  const logout = document.querySelector("#logout-button");
  logout.addEventListener("click", async () => {
    logout.disabled = true;
    logout.textContent = "Logging out…";
    document.querySelector("#logout-error").hidden = true;
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Logout failed");
      window.location.replace("/login");
    } catch {
      document.querySelector("#logout-error").hidden = false;
      logout.disabled = false;
      logout.textContent = "Retry logout";
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

window.PhoenixUI = { loadSession, responseMessage, setupAuthenticatedShell };

if (page === "dashboard") {

  async function loadWorkflowReport() {
    const section = document.querySelector("#workflow-report");
    const error = document.querySelector("#report-error");
    section.hidden = false;
    try {
      const response = await fetch("/api/reports/vertical-1", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) throw new Error(await responseMessage(response, "Workflow report could not be loaded."));
      const report = await response.json();
      document.querySelector("#report-lead-conversion").textContent = `${report.leads.conversionRatePercent}%`;
      document.querySelector("#report-lead-detail").textContent = `${report.leads.converted} converted of ${report.leads.total} leads`;
      document.querySelector("#report-approved-offers").textContent = String(report.offers.approved);
      document.querySelector("#report-offer-detail").textContent = `${report.offers.pendingApproval} pending · ${report.offers.rejected} rejected`;
      document.querySelector("#report-task-completion").textContent = `${report.tasks.completionRatePercent}%`;
      document.querySelector("#report-task-detail").textContent = `${report.tasks.completed} completed of ${report.tasks.total} tasks`;
      document.querySelector("#report-attention-count").textContent = String(report.attention.total);
      document.querySelector("#report-attention-detail").textContent = `${report.attention.overdueTasks} overdue tasks · ${report.attention.pendingApprovals} approvals pending`;
      document.querySelector("#report-generated-at").textContent = `As of ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.generatedAt))}`;
    } catch (caught) {
      error.textContent = caught.message || "Workflow report could not be loaded.";
      error.hidden = false;
      document.querySelector("#report-generated-at").textContent = "Unavailable";
    }
  }

  Promise.all([
    loadSession(),
    fetch("/health", { headers: { Accept: "application/json" } }).then((response) => response.ok ? response.json() : null).catch(() => null),
  ]).then(([session, health]) => {
    if (!session) {
      window.location.replace("/login");
      return;
    }
    setupAuthenticatedShell(session);
    const { user } = session;
    const firstName = user.displayName.trim().split(/\s+/)[0] || user.displayName;
    document.querySelector("#welcome-name").textContent = firstName;
    document.querySelector("#account-name").textContent = user.displayName;
    document.querySelector("#account-email").textContent = `${user.email} · ${user.role}`;

    const healthy = health?.status === "ok";
    document.querySelector("#backend-status").textContent = healthy ? "Operational" : "Unavailable";
    document.querySelector("#backend-detail").textContent = healthy ? "API and database are ready" : "Health check did not succeed";
    if (["ADMIN", "MANAGER"].includes(user.role)) loadWorkflowReport();
  }).catch(() => window.location.replace("/login"));
}

if (page === "leads") {
  const leadList = document.querySelector("#lead-list");
  const message = document.querySelector("#workspace-message");
  const leadDialog = document.querySelector("#lead-dialog");
  const qualifyDialog = document.querySelector("#qualify-dialog");

  function showMessage(text, kind = "success") {
    message.textContent = text;
    message.className = `workspace-message ${kind}`;
    message.hidden = false;
  }

  function actionButton(label, action, leadId, style = "secondary-button") {
    const button = document.createElement("button");
    button.className = `${style} table-action`;
    button.type = "button";
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.leadId = leadId;
    return button;
  }

  function setCellText(row, text, className) {
    const cell = row.insertCell();
    if (className) cell.className = className;
    cell.textContent = text;
    return cell;
  }

  function renderLeads(leads) {
    leadList.replaceChildren();
    document.querySelector("#lead-count-all").textContent = String(leads.length);
    for (const status of ["NEW", "QUALIFIED", "CONVERTED"]) {
      document.querySelector(`#lead-count-${status.toLowerCase()}`).textContent = String(leads.filter((lead) => lead.status === status).length);
    }
    if (!leads.length) {
      const row = leadList.insertRow();
      const cell = setCellText(row, "No leads yet. Create the first opportunity to begin the pipeline.", "empty-cell");
      cell.colSpan = 5;
      return;
    }

    for (const lead of leads) {
      const row = leadList.insertRow();
      const company = row.insertCell();
      const companyName = document.createElement("strong");
      companyName.textContent = lead.companyName;
      company.append(companyName);
      if (lead.qualificationNotes) {
        const notes = document.createElement("small");
        notes.textContent = lead.qualificationNotes;
        company.append(notes);
      }

      const contactName = lead.contact ? [lead.contact.firstName, lead.contact.lastName].filter(Boolean).join(" ") : "No contact";
      const contact = setCellText(row, contactName);
      if (lead.contact?.email) {
        const email = document.createElement("small");
        email.textContent = lead.contact.email;
        contact.append(email);
      }

      const statusCell = row.insertCell();
      const badge = document.createElement("span");
      badge.className = `status-badge ${lead.status.toLowerCase()}`;
      badge.textContent = lead.status.charAt(0) + lead.status.slice(1).toLowerCase();
      statusCell.append(badge);
      setCellText(row, new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(lead.updatedAt)), "date-cell");

      const actions = row.insertCell();
      actions.className = "table-actions";
      if (lead.status === "NEW") actions.append(actionButton("Qualify", "qualify", lead.id));
      if (lead.status === "QUALIFIED") actions.append(actionButton("Convert", "convert", lead.id, "primary-button"));
      if (lead.status === "CONVERTED") {
        actions.classList.add("action-complete");
        actions.textContent = "Client created";
      }
    }
  }

  async function loadLeads() {
    document.querySelector("#refresh-leads").disabled = true;
    try {
      const response = await fetch("/api/leads", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) throw new Error(await responseMessage(response, "Leads could not be loaded."));
      renderLeads((await response.json()).data);
    } catch (error) {
      leadList.innerHTML = '<tr><td colspan="5" class="empty-cell error-text">Leads could not be loaded. Try again.</td></tr>';
      showMessage(error.message || "Leads could not be loaded.", "error");
    } finally {
      document.querySelector("#refresh-leads").disabled = false;
    }
  }

  async function mutateLead(path, body, idempotencyKey) {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
    if (response.status === 401) {
      window.location.replace("/login");
      throw new Error("Session expired");
    }
    if (!response.ok) throw new Error(await responseMessage(response, "The lead could not be updated."));
    return response.json();
  }

  loadSession().then((session) => {
    if (!session) {
      window.location.replace("/login");
      return;
    }
    setupAuthenticatedShell(session);
    return loadLeads();
  }).catch(() => window.location.replace("/login"));

  document.querySelector("#refresh-leads").addEventListener("click", loadLeads);
  document.querySelector("#new-lead-button").addEventListener("click", () => {
    delete document.querySelector("#lead-form").dataset.idempotencyKey;
    leadDialog.showModal();
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`).close()));

  document.querySelector("#lead-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector("button[type='submit']");
    const companyName = document.querySelector("#company-name");
    const firstName = document.querySelector("#contact-first-name");
    const lastName = document.querySelector("#contact-last-name");
    const email = document.querySelector("#contact-email");
    const phone = document.querySelector("#contact-phone");
    const formError = document.querySelector("#lead-form-error");
    formError.hidden = true;
    const companyValid = Boolean(companyName.value.trim());
    const emailValid = email.validity.valid;
    document.querySelector("#company-name-error").textContent = companyValid ? "" : "Company name is required.";
    companyName.setAttribute("aria-invalid", String(!companyValid));
    document.querySelector("#contact-email-error").textContent = emailValid ? "" : "Enter a valid email address.";
    email.setAttribute("aria-invalid", String(!emailValid));
    const hasContactDetails = Boolean(lastName.value.trim() || email.value.trim() || phone.value.trim());
    const phoneValid = !phone.value.trim() || phone.value.trim().length >= 3;
    const firstNameValid = !hasContactDetails || Boolean(firstName.value.trim());
    document.querySelector("#contact-phone-error").textContent = phoneValid ? "" : "Phone must contain at least 3 characters.";
    phone.setAttribute("aria-invalid", String(!phoneValid));
    document.querySelector("#contact-first-name-error").textContent = firstNameValid ? "" : "First name is required when adding contact details.";
    firstName.setAttribute("aria-invalid", String(!firstNameValid));
    if (!companyValid || !emailValid || !phoneValid || !firstNameValid) return;
    const contact = firstName.value.trim() ? {
      firstName: firstName.value.trim(),
      ...(lastName.value.trim() ? { lastName: lastName.value.trim() } : {}),
      ...(email.value.trim() ? { email: email.value.trim() } : {}),
      ...(phone.value.trim() ? { phone: phone.value.trim() } : {}),
    } : undefined;
    submit.disabled = true;
    try {
      form.dataset.idempotencyKey ||= crypto.randomUUID();
      await mutateLead("/api/leads", { companyName: companyName.value.trim(), ...(contact ? { contact } : {}) }, form.dataset.idempotencyKey);
      delete form.dataset.idempotencyKey;
      form.reset();
      leadDialog.close();
      showMessage("Lead created successfully.");
      await loadLeads();
    } catch (error) {
      formError.textContent = error.message || "Lead could not be created.";
      formError.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  leadList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "qualify") {
      delete document.querySelector("#qualify-form").dataset.idempotencyKey;
      document.querySelector("#qualify-lead-id").value = button.dataset.leadId;
      document.querySelector("#qualification-notes").value = "";
      document.querySelector("#qualify-error").hidden = true;
      qualifyDialog.showModal();
      return;
    }
    if (button.dataset.action === "convert" && window.confirm("Convert this qualified lead into a client? This transition cannot be reversed.")) {
      button.disabled = true;
      try {
        button.dataset.idempotencyKey ||= crypto.randomUUID();
        await mutateLead(`/api/leads/${button.dataset.leadId}/convert`, {}, button.dataset.idempotencyKey);
        delete button.dataset.idempotencyKey;
        showMessage("Lead converted to a client.");
        await loadLeads();
      } catch (error) {
        showMessage(error.message || "Lead could not be converted.", "error");
        button.disabled = false;
      }
    }
  });

  document.querySelector("#qualify-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector("button[type='submit']");
    const notes = document.querySelector("#qualification-notes").value.trim();
    const error = document.querySelector("#qualify-error");
    error.hidden = true;
    submit.disabled = true;
    try {
      event.currentTarget.dataset.idempotencyKey ||= crypto.randomUUID();
      await mutateLead(`/api/leads/${document.querySelector("#qualify-lead-id").value}/qualify`, notes ? { notes } : {}, event.currentTarget.dataset.idempotencyKey);
      delete event.currentTarget.dataset.idempotencyKey;
      qualifyDialog.close();
      showMessage("Lead marked as qualified.");
      await loadLeads();
    } catch (caught) {
      error.textContent = caught.message || "Lead could not be qualified.";
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
}
