const { loadSession, responseMessage, setupAuthenticatedShell } = window.PhoenixUI;
const taskList = document.querySelector("#task-list");
const workspaceMessage = document.querySelector("#workspace-message");
const completeTaskDialog = document.querySelector("#complete-task-dialog");
const assignTaskDialog = document.querySelector("#assign-task-dialog");
const rescheduleTaskDialog = document.querySelector("#reschedule-task-dialog");
let tasks = [];
let activeFilter = "all";
let canAssignTasks = false;
let assignees = [];
let currentUser = null;

function dueCategory(dueAt, now = new Date()) {
  const due = new Date(dueAt);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (due < now) return "overdue";
  if (due < startTomorrow && due >= startToday) return "today";
  return "upcoming";
}

function taskCategory(task, now) {
  return task.status === "COMPLETED" ? "completed" : dueCategory(task.dueAt, now);
}

function appendTextCell(row, text, className) {
  const cell = row.insertCell();
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function renderTasks() {
  const now = new Date();
  const counts = { overdue: 0, today: 0, upcoming: 0 };
  const openTasks = tasks.filter((task) => task.status === "OPEN");
  for (const task of openTasks) counts[dueCategory(task.dueAt, now)] += 1;
  document.querySelector("#task-count-open").textContent = String(openTasks.length);
  document.querySelector("#task-count-overdue").textContent = String(counts.overdue);
  document.querySelector("#task-count-today").textContent = String(counts.today);
  document.querySelector("#task-count-upcoming").textContent = String(counts.upcoming);

  const visibleTasks = activeFilter === "all" ? tasks : tasks.filter((task) => taskCategory(task, now) === activeFilter);
  taskList.replaceChildren();
  if (!visibleTasks.length) {
    const row = taskList.insertRow();
    const message = tasks.length ? `No ${activeFilter} tasks.` : "No follow-up tasks yet. Schedule one from Commercial Offers.";
    const cell = appendTextCell(row, message, "empty-cell");
    cell.colSpan = 6;
    return;
  }

  for (const task of visibleTasks) {
    const category = taskCategory(task, now);
    const row = taskList.insertRow();
    const title = appendTextCell(row, "Commercial follow-up");
    if (task.notes) {
      const notes = document.createElement("small");
      notes.textContent = task.notes;
      title.append(notes);
    }
    if (task.completionNote) {
      const outcome = document.createElement("small");
      outcome.textContent = `Outcome: ${task.completionNote}`;
      title.append(outcome);
    }
    const owner = appendTextCell(row, task.assigneeDisplayName || "Unassigned");
    if (task.assigneeRole) {
      const role = document.createElement("small");
      role.textContent = `${task.assigneeRole}${task.assigneeActive === false ? " · Inactive" : ""}`;
      owner.append(role);
    }
    appendTextCell(row, `${task.relatedEntityType.replaceAll("_", " ")} #${task.relatedEntityId.slice(0, 8)}`);
    appendTextCell(row, new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(task.dueAt)), `date-cell task-due ${category}`);
    const statusCell = row.insertCell();
    const status = document.createElement("span");
    status.className = `status-badge task-${category}`;
    status.textContent = category === "overdue" ? "Overdue" : category === "today" ? "Due today" : category === "completed" ? "Completed" : "Upcoming";
    statusCell.append(status);
    const action = row.insertCell();
    action.className = "table-actions";
    const link = document.createElement("a");
    link.className = "secondary-button table-action inline-action";
    link.href = "/commercial-offers";
    link.textContent = "View offers";
    action.append(link);
    const canReschedule = task.status === "OPEN" && (["ADMIN", "MANAGER"].includes(currentUser.role) || task.assigneeId === currentUser.userId);
    if (canReschedule) {
      const reschedule = document.createElement("button");
      reschedule.type = "button";
      reschedule.className = "secondary-button table-action";
      reschedule.dataset.rescheduleTask = task.id;
      reschedule.textContent = "Reschedule";
      action.append(reschedule);
    }
    if (canAssignTasks && task.status === "OPEN") {
      const assign = document.createElement("button");
      assign.type = "button";
      assign.className = "secondary-button table-action";
      assign.dataset.assignTask = task.id;
      assign.textContent = task.assigneeId ? "Reassign" : "Assign";
      action.append(assign);
    }
    if (task.status === "OPEN") {
      const complete = document.createElement("button");
      complete.type = "button";
      complete.className = "primary-button table-action";
      complete.dataset.completeTask = task.id;
      complete.textContent = "Complete";
      action.append(complete);
    }
  }
}

async function completeTask(taskId, note, idempotencyKey) {
  const response = await fetch(`/api/tasks/${taskId}/complete`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(note ? { note } : {}),
  });
  if (response.status === 401) {
    window.location.replace("/login");
    throw new Error("Session expired");
  }
  if (!response.ok) throw new Error(await responseMessage(response, "Task could not be completed."));
  return response.json();
}

async function assignTask(taskId, assigneeId, idempotencyKey) {
  const response = await fetch(`/api/tasks/${taskId}/assign`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ assigneeId: assigneeId || null }),
  });
  if (response.status === 401) {
    window.location.replace("/login");
    throw new Error("Session expired");
  }
  if (!response.ok) throw new Error(await responseMessage(response, "Task owner could not be updated."));
  return response.json();
}

async function rescheduleTask(taskId, dueAt, idempotencyKey) {
  const response = await fetch(`/api/tasks/${taskId}/reschedule`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ dueAt }),
  });
  if (response.status === 401) {
    window.location.replace("/login");
    throw new Error("Session expired");
  }
  if (!response.ok) throw new Error(await responseMessage(response, "Task due date could not be updated."));
  return response.json();
}

function localDateTimeValue(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

async function loadTasks() {
  const refresh = document.querySelector("#refresh-tasks");
  refresh.disabled = true;
  workspaceMessage.hidden = true;
  try {
    const requests = [fetch("/api/tasks", { credentials: "same-origin", headers: { Accept: "application/json" } })];
    if (canAssignTasks) requests.push(fetch("/api/task-assignees", { credentials: "same-origin", headers: { Accept: "application/json" } }));
    const [response, assigneeResponse] = await Promise.all(requests);
    if (response.status === 401 || assigneeResponse?.status === 401) {
      window.location.replace("/login");
      return;
    }
    if (!response.ok) throw new Error(await responseMessage(response, "Tasks could not be loaded."));
    if (assigneeResponse && !assigneeResponse.ok) throw new Error(await responseMessage(assigneeResponse, "Task owners could not be loaded."));
    tasks = (await response.json()).data;
    assignees = assigneeResponse ? (await assigneeResponse.json()).data : [];
    renderTasks();
    return true;
  } catch (error) {
    taskList.innerHTML = '<tr><td colspan="6" class="empty-cell error-text">Tasks could not be loaded. Try again.</td></tr>';
    workspaceMessage.textContent = error.message || "Tasks could not be loaded.";
    workspaceMessage.className = "workspace-message error";
    workspaceMessage.hidden = false;
    return false;
  } finally {
    refresh.disabled = false;
  }
}

loadSession().then((session) => {
  if (!session) {
    window.location.replace("/login");
    return;
  }
  setupAuthenticatedShell(session);
  currentUser = session.user;
  canAssignTasks = ["ADMIN", "MANAGER"].includes(session.user.role);
  return loadTasks();
}).catch(() => window.location.replace("/login"));

document.querySelector("#refresh-tasks").addEventListener("click", loadTasks);
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`).close()));
taskList.addEventListener("click", (event) => {
  const rescheduleButton = event.target.closest("button[data-reschedule-task]");
  if (rescheduleButton) {
    const task = tasks.find((candidate) => candidate.id === rescheduleButton.dataset.rescheduleTask);
    const form = document.querySelector("#reschedule-task-form");
    form.reset();
    delete form.dataset.idempotencyKey;
    document.querySelector("#reschedule-task-id").value = task.id;
    const due = document.querySelector("#reschedule-task-due");
    due.min = localDateTimeValue(new Date(Date.now() + 60_000));
    due.value = localDateTimeValue(task.dueAt);
    document.querySelector("#reschedule-task-due-error").textContent = "";
    document.querySelector("#reschedule-task-error").hidden = true;
    rescheduleTaskDialog.showModal();
    return;
  }
  const assignButton = event.target.closest("button[data-assign-task]");
  if (assignButton) {
    const task = tasks.find((candidate) => candidate.id === assignButton.dataset.assignTask);
    const form = document.querySelector("#assign-task-form");
    form.reset();
    delete form.dataset.idempotencyKey;
    document.querySelector("#assign-task-id").value = task.id;
    const select = document.querySelector("#task-assignee");
    select.replaceChildren(new Option("Unassigned", ""));
    for (const assignee of assignees) select.add(new Option(`${assignee.displayName} · ${assignee.role}`, assignee.id));
    select.value = task.assigneeId || "";
    document.querySelector("#assign-task-error").hidden = true;
    document.querySelector("#task-assignee-error").textContent = "";
    assignTaskDialog.showModal();
    return;
  }
  const button = event.target.closest("button[data-complete-task]");
  if (!button) return;
  const form = document.querySelector("#complete-task-form");
  form.reset();
  delete form.dataset.idempotencyKey;
  document.querySelector("#complete-task-id").value = button.dataset.completeTask;
  document.querySelector("#complete-task-error").hidden = true;
  completeTaskDialog.showModal();
});

document.querySelector("#reschedule-task-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const taskId = document.querySelector("#reschedule-task-id").value;
  const due = document.querySelector("#reschedule-task-due");
  const dueDate = new Date(due.value);
  const task = tasks.find((candidate) => candidate.id === taskId);
  const valid = Boolean(due.value && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() > Date.now() && dueDate.getTime() !== new Date(task.dueAt).getTime());
  document.querySelector("#reschedule-task-due-error").textContent = valid ? "" : "Choose a different future date and time.";
  due.setAttribute("aria-invalid", String(!valid));
  if (!valid) return;
  const error = document.querySelector("#reschedule-task-error");
  error.hidden = true;
  submit.disabled = true;
  try {
    form.dataset.idempotencyKey ||= crypto.randomUUID();
    await rescheduleTask(taskId, dueDate.toISOString(), form.dataset.idempotencyKey);
    delete form.dataset.idempotencyKey;
    rescheduleTaskDialog.close();
    if (await loadTasks()) {
      workspaceMessage.textContent = "Task due date updated.";
      workspaceMessage.className = "workspace-message";
      workspaceMessage.hidden = false;
    }
  } catch (caught) {
    error.textContent = caught.message || "Task due date could not be updated.";
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#assign-task-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const taskId = document.querySelector("#assign-task-id").value;
  const assigneeId = document.querySelector("#task-assignee").value;
  const task = tasks.find((candidate) => candidate.id === taskId);
  const changed = (task.assigneeId || "") !== assigneeId;
  document.querySelector("#task-assignee-error").textContent = changed ? "" : "Choose a different owner.";
  if (!changed) return;
  const error = document.querySelector("#assign-task-error");
  error.hidden = true;
  submit.disabled = true;
  try {
    form.dataset.idempotencyKey ||= crypto.randomUUID();
    await assignTask(taskId, assigneeId, form.dataset.idempotencyKey);
    delete form.dataset.idempotencyKey;
    assignTaskDialog.close();
    if (await loadTasks()) {
      workspaceMessage.textContent = assigneeId ? "Task owner updated." : "Task is now unassigned.";
      workspaceMessage.className = "workspace-message";
      workspaceMessage.hidden = false;
    }
  } catch (caught) {
    error.textContent = caught.message || "Task owner could not be updated.";
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#complete-task-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector("button[type='submit']");
  const error = document.querySelector("#complete-task-error");
  const note = document.querySelector("#completion-note").value.trim();
  error.hidden = true;
  submit.disabled = true;
  try {
    form.dataset.idempotencyKey ||= crypto.randomUUID();
    await completeTask(document.querySelector("#complete-task-id").value, note, form.dataset.idempotencyKey);
    delete form.dataset.idempotencyKey;
    completeTaskDialog.close();
    if (await loadTasks()) {
      workspaceMessage.textContent = "Follow-up task completed.";
      workspaceMessage.className = "workspace-message";
      workspaceMessage.hidden = false;
    }
  } catch (caught) {
    error.textContent = caught.message || "Task could not be completed.";
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

document.querySelectorAll("[data-task-filter]").forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.dataset.taskFilter;
  document.querySelectorAll("[data-task-filter]").forEach((candidate) => {
    const selected = candidate === button;
    candidate.classList.toggle("active", selected);
    candidate.setAttribute("aria-pressed", String(selected));
  });
  renderTasks();
}));
