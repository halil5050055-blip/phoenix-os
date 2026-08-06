const { loadSession, responseMessage, setupAuthenticatedShell } = window.PhoenixUI;
const offerList = document.querySelector("#offer-list");
const workspaceMessage = document.querySelector("#workspace-message");
const offerDialog = document.querySelector("#offer-dialog");
const approvalDialog = document.querySelector("#approval-dialog");
const followUpDialog = document.querySelector("#follow-up-dialog");
const decisionDialog = document.querySelector("#decision-dialog");
const clientNames = new Map();
let canManageOffers = false;
let canDecideApprovals = false;

function showOfferMessage(text, kind = "success") {
  workspaceMessage.textContent = text;
  workspaceMessage.className = `workspace-message ${kind}`;
  workspaceMessage.hidden = false;
}

function offerAction(label, action, offerId, primary = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${primary ? "primary-button" : "secondary-button"} table-action`;
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.offerId = offerId;
  return button;
}

function appendTextCell(row, text, className) {
  const cell = row.insertCell();
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function formatMoney(amountMinor, currency) {
  return `${currency} ${new Intl.NumberFormat().format(amountMinor)} minor`;
}

function renderOfferTotals(offers) {
  const totals = new Map();
  for (const offer of offers) totals.set(offer.currency, (totals.get(offer.currency) || 0n) + BigInt(offer.totalMinor));
  document.querySelector("#offer-total-value").textContent = totals.size
    ? [...totals].map(([currency, amount]) => formatMoney(amount, currency)).join(" · ")
    : "—";
}

function renderOffers(offers) {
  offerList.replaceChildren();
  document.querySelector("#offer-count-all").textContent = String(offers.length);
  document.querySelector("#offer-count-draft").textContent = String(offers.filter((offer) => offer.status === "DRAFT").length);
  document.querySelector("#offer-count-pending").textContent = String(offers.filter((offer) => offer.status === "PENDING_APPROVAL").length);
  renderOfferTotals(offers);

  if (!offers.length) {
    const row = offerList.insertRow();
    const cell = appendTextCell(row, "No commercial offers yet. Create a draft after converting a qualified lead.", "empty-cell");
    cell.colSpan = 6;
    return;
  }

  for (const offer of offers) {
    const row = offerList.insertRow();
    appendTextCell(row, clientNames.get(offer.clientId) || offer.clientId);
    const summary = appendTextCell(row, `#${offer.id.slice(0, 8)}`);
    const items = document.createElement("small");
    items.textContent = offer.items.map((item) => `${item.quantity}× ${item.description}`).join(", ");
    summary.append(items);

    const statusCell = row.insertCell();
    const status = document.createElement("span");
    const statusPresentation = {
      DRAFT: ["new", "Draft"],
      PENDING_APPROVAL: ["qualified", "Pending approval"],
      APPROVED: ["converted", "Approved"],
      REJECTED: ["task-overdue", "Rejected"],
    }[offer.status] || ["new", offer.status];
    status.className = `status-badge ${statusPresentation[0]}`;
    status.textContent = statusPresentation[1];
    statusCell.append(status);
    appendTextCell(row, formatMoney(offer.totalMinor, offer.currency), "money-cell");
    appendTextCell(row, new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(offer.updatedAt)), "date-cell");

    const actions = row.insertCell();
    actions.className = "table-actions offer-actions";
    if (canManageOffers) {
      if (offer.status === "DRAFT") actions.append(offerAction("Submit", "approve", offer.id, true));
      actions.append(offerAction("Follow up", "follow-up", offer.id));
    }
    if (canDecideApprovals && offer.status === "PENDING_APPROVAL") {
      actions.append(offerAction("Approve", "decision-approve", offer.id, true));
      actions.append(offerAction("Reject", "decision-reject", offer.id));
    }
    if (!actions.childElementCount) {
      actions.classList.add("action-complete");
      actions.textContent = "Read only";
    }
  }
}

async function loadOfferData() {
  const refresh = document.querySelector("#refresh-offers");
  refresh.disabled = true;
  try {
    const [offerResponse, clientResponse] = await Promise.all([
      fetch("/api/commercial-offers", { credentials: "same-origin", headers: { Accept: "application/json" } }),
      fetch("/api/clients", { credentials: "same-origin", headers: { Accept: "application/json" } }),
    ]);
    if (offerResponse.status === 401 || clientResponse.status === 401) {
      window.location.replace("/login");
      return;
    }
    if (!offerResponse.ok) throw new Error(await responseMessage(offerResponse, "Commercial offers could not be loaded."));
    if (!clientResponse.ok) throw new Error(await responseMessage(clientResponse, "Clients could not be loaded."));
    const [offerBody, clientBody] = await Promise.all([offerResponse.json(), clientResponse.json()]);
    clientNames.clear();
    const select = document.querySelector("#offer-client");
    select.replaceChildren(new Option("Select a converted client", ""));
    for (const client of clientBody.data) {
      clientNames.set(client.id, client.name);
      select.add(new Option(client.name, client.id));
    }
    renderOffers(offerBody.data);
  } catch (error) {
    offerList.innerHTML = '<tr><td colspan="6" class="empty-cell error-text">Commercial offers could not be loaded. Try again.</td></tr>';
    showOfferMessage(error.message || "Commercial offers could not be loaded.", "error");
  } finally {
    refresh.disabled = false;
  }
}

async function mutateOffer(path, body, idempotencyKey) {
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
  if (!response.ok) throw new Error(await responseMessage(response, "The offer could not be updated."));
  return response.json();
}

let offerItemSequence = 0;
function addOfferItem(values = {}) {
  offerItemSequence += 1;
  const row = document.createElement("div");
  row.className = "offer-item-row";
  row.innerHTML = `
    <div class="field item-description"><label for="item-description-${offerItemSequence}">Description</label><input id="item-description-${offerItemSequence}" data-item="description" maxlength="200" required></div>
    <div class="field"><label for="item-quantity-${offerItemSequence}">Quantity</label><input id="item-quantity-${offerItemSequence}" data-item="quantity" type="number" min="1" max="1000000" step="1" value="1" required></div>
    <div class="field"><label for="item-price-${offerItemSequence}">Unit price minor</label><input id="item-price-${offerItemSequence}" data-item="unitPriceMinor" type="number" min="0" step="1" value="0" required></div>
    <button class="icon-button remove-item" type="button" aria-label="Remove line item">×</button>
    <p class="field-error item-error" data-item-error role="alert"></p>`;
  row.querySelector('[data-item="description"]').value = values.description || "";
  row.querySelector('[data-item="quantity"]').value = values.quantity || 1;
  row.querySelector('[data-item="unitPriceMinor"]').value = values.unitPriceMinor || 0;
  row.querySelector(".remove-item").addEventListener("click", () => {
    if (document.querySelectorAll(".offer-item-row").length > 1) {
      row.remove();
      document.querySelector("#add-offer-item").disabled = false;
    }
  });
  document.querySelector("#offer-items").append(row);
  document.querySelector("#add-offer-item").disabled = document.querySelectorAll(".offer-item-row").length >= 500;
}

loadSession().then((session) => {
  if (!session) {
    window.location.replace("/login");
    return;
  }
  setupAuthenticatedShell(session);
  canManageOffers = ["ADMIN", "MANAGER", "SALES"].includes(session.user.role);
  canDecideApprovals = ["ADMIN", "ACCOUNTANT"].includes(session.user.role);
  document.querySelector("#new-offer-button").hidden = !canManageOffers;
  return loadOfferData();
}).catch(() => window.location.replace("/login"));

document.querySelector("#refresh-offers").addEventListener("click", loadOfferData);
document.querySelector("#add-offer-item").addEventListener("click", () => {
  if (document.querySelectorAll(".offer-item-row").length < 500) addOfferItem();
});
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`).close()));

document.querySelector("#new-offer-button").addEventListener("click", () => {
  const form = document.querySelector("#offer-form");
  form.reset();
  delete form.dataset.idempotencyKey;
  document.querySelector("#offer-currency").value = "EUR";
  document.querySelector("#offer-items").replaceChildren();
  addOfferItem();
  document.querySelector("#offer-form-error").hidden = true;
  offerDialog.showModal();
});

document.querySelector("#offer-currency").addEventListener("input", (event) => {
  event.target.value = event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
});

document.querySelector("#offer-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const client = document.querySelector("#offer-client");
  const currency = document.querySelector("#offer-currency");
  const error = document.querySelector("#offer-form-error");
  const itemRows = [...document.querySelectorAll(".offer-item-row")];
  const items = itemRows.map((row) => ({
      description: row.querySelector('[data-item="description"]').value.trim(),
      quantity: Number(row.querySelector('[data-item="quantity"]').value),
      unitPriceMinor: Number(row.querySelector('[data-item="unitPriceMinor"]').value),
    }));
  const clientValid = Boolean(client.value);
  const currencyValid = /^[A-Z]{3}$/.test(currency.value);
  const itemValidity = items.map((item) => Boolean(item.description && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 1_000_000 && Number.isSafeInteger(item.unitPriceMinor) && item.unitPriceMinor >= 0));
  const itemsValid = items.length > 0 && items.length <= 500 && itemValidity.every(Boolean);
  itemRows.forEach((row, index) => {
    row.querySelector("[data-item-error]").textContent = itemValidity[index] ? "" : "Use a description, quantity from 1 to 1,000,000, and a safe non-negative integer price.";
    row.classList.toggle("invalid", !itemValidity[index]);
  });
  document.querySelector("#offer-client-error").textContent = clientValid ? "" : "Select a client.";
  document.querySelector("#offer-currency-error").textContent = currencyValid ? "" : "Use a 3-letter currency code.";
  client.setAttribute("aria-invalid", String(!clientValid));
  currency.setAttribute("aria-invalid", String(!currencyValid));
  error.hidden = true;
  if (!clientValid || !currencyValid || !itemsValid) {
    if (!itemsValid) {
      error.textContent = items.length > 500 ? "An offer may contain at most 500 line items." : "Correct the highlighted line items.";
      error.hidden = false;
    }
    return;
  }

  submit.disabled = true;
  try {
    form.dataset.idempotencyKey ||= crypto.randomUUID();
    await mutateOffer("/api/commercial-offers", { clientId: client.value, currency: currency.value, items }, form.dataset.idempotencyKey);
    delete form.dataset.idempotencyKey;
    offerDialog.close();
    showOfferMessage("Commercial offer draft created.");
    await loadOfferData();
  } catch (caught) {
    error.textContent = caught.message || "Commercial offer could not be created.";
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

offerList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "approve") {
    const form = document.querySelector("#approval-form");
    form.reset();
    delete form.dataset.idempotencyKey;
    document.querySelector("#approval-offer-id").value = button.dataset.offerId;
    document.querySelector("#approval-error").hidden = true;
    approvalDialog.showModal();
  }
  if (button.dataset.action === "follow-up") {
    const form = document.querySelector("#follow-up-form");
    form.reset();
    delete form.dataset.idempotencyKey;
    document.querySelector("#follow-up-offer-id").value = button.dataset.offerId;
    document.querySelector("#follow-up-error").hidden = true;
    followUpDialog.showModal();
  }
  if (button.dataset.action.startsWith("decision-")) {
    const decision = button.dataset.action === "decision-approve" ? "APPROVED" : "REJECTED";
    const form = document.querySelector("#decision-form");
    form.reset();
    delete form.dataset.idempotencyKey;
    document.querySelector("#decision-offer-id").value = button.dataset.offerId;
    document.querySelector("#decision-value").value = decision;
    document.querySelector("#decision-title").textContent = decision === "APPROVED" ? "Approve commercial offer" : "Reject commercial offer";
    document.querySelector("#decision-reason-requirement").textContent = decision === "REJECTED" ? "(required)" : "(optional)";
    document.querySelector("#decision-submit").textContent = decision === "APPROVED" ? "Approve offer" : "Reject offer";
    document.querySelector("#decision-reason-error").textContent = "";
    document.querySelector("#decision-error").hidden = true;
    decisionDialog.showModal();
  }
});

document.querySelector("#approval-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const reason = document.querySelector("#approval-reason").value.trim();
  const error = document.querySelector("#approval-error");
  error.hidden = true;
  submit.disabled = true;
  try {
    form.dataset.idempotencyKey ||= crypto.randomUUID();
    await mutateOffer(`/api/commercial-offers/${document.querySelector("#approval-offer-id").value}/submit-for-approval`, reason ? { reason } : {}, form.dataset.idempotencyKey);
    delete form.dataset.idempotencyKey;
    approvalDialog.close();
    showOfferMessage("Offer submitted for approval.");
    await loadOfferData();
  } catch (caught) {
    error.textContent = caught.message || "Offer could not be submitted.";
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#follow-up-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const due = document.querySelector("#follow-up-due");
  const notes = document.querySelector("#follow-up-notes").value.trim();
  const error = document.querySelector("#follow-up-error");
  const dueDate = new Date(due.value);
  const dueValid = Boolean(due.value && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() > Date.now());
  document.querySelector("#follow-up-due-error").textContent = dueValid ? "" : "Choose a future date and time.";
  due.setAttribute("aria-invalid", String(!dueValid));
  error.hidden = true;
  if (!dueValid) return;
  submit.disabled = true;
  try {
    form.dataset.idempotencyKey ||= crypto.randomUUID();
    await mutateOffer(`/api/commercial-offers/${document.querySelector("#follow-up-offer-id").value}/follow-up`, { dueAt: dueDate.toISOString(), ...(notes ? { notes } : {}) }, form.dataset.idempotencyKey);
    delete form.dataset.idempotencyKey;
    followUpDialog.close();
    showOfferMessage("Follow-up task created.");
  } catch (caught) {
    error.textContent = caught.message || "Follow-up could not be created.";
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#decision-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const decision = document.querySelector("#decision-value").value;
  const reason = document.querySelector("#decision-reason").value.trim();
  const reasonValid = decision !== "REJECTED" || Boolean(reason);
  const error = document.querySelector("#decision-error");
  document.querySelector("#decision-reason-error").textContent = reasonValid ? "" : "Explain why the offer is being rejected.";
  document.querySelector("#decision-reason").setAttribute("aria-invalid", String(!reasonValid));
  error.hidden = true;
  if (!reasonValid) return;
  submit.disabled = true;
  try {
    form.dataset.idempotencyKey ||= crypto.randomUUID();
    await mutateOffer(`/api/commercial-offers/${document.querySelector("#decision-offer-id").value}/approval-decision`, { decision, ...(reason ? { reason } : {}) }, form.dataset.idempotencyKey);
    delete form.dataset.idempotencyKey;
    decisionDialog.close();
    showOfferMessage(decision === "APPROVED" ? "Commercial offer approved." : "Commercial offer rejected.");
    await loadOfferData();
  } catch (caught) {
    error.textContent = caught.message || "The approval decision could not be recorded.";
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});
