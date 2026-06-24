import { addManagedUser, fetchManagedUsers, removeManagedUser } from "./admin-api.js";
import { getCurrentUser } from "./auth.js";

const els = {
  panel: document.getElementById("admin-panel"),
  openButton: document.getElementById("btn-admin-panel"),
  closeButton: document.getElementById("btn-close-admin-panel"),
  form: document.getElementById("admin-add-user-form"),
  steamIdInput: document.getElementById("admin-steam-id"),
  usersBody: document.getElementById("admin-users-body"),
  status: document.getElementById("admin-panel-status"),
  submitButton: document.getElementById("btn-admin-add-user"),
};

let users = [];

export function initAdminPanel() {
  const user = getCurrentUser();
  if (user?.role !== "admin" || !els.panel) {
    return;
  }

  els.openButton?.classList.remove("hidden");
  els.openButton?.addEventListener("click", openPanel);
  els.closeButton?.addEventListener("click", closePanel);
  els.panel?.addEventListener("click", (event) => {
    if (event.target === els.panel) {
      closePanel();
    }
  });
  els.form?.addEventListener("submit", onAddUser);
}

function openPanel() {
  els.panel?.showModal();
  setStatus("");
  void loadUsers();
}

function closePanel() {
  els.panel?.close();
}

function setStatus(message, isError = false) {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.classList.toggle("admin-panel__status--error", Boolean(message && isError));
}

async function loadUsers() {
  setStatus("Loading members…");
  try {
    users = await fetchManagedUsers();
    users.sort((a, b) => {
      if (a.role !== b.role) {
        return a.role === "admin" ? -1 : 1;
      }
      return (a.name || a.steamId).localeCompare(b.name || b.steamId);
    });
    renderUsers();
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not load members", true);
  }
}

function renderUsers() {
  if (!els.usersBody) return;

  els.usersBody.innerHTML = "";

  if (users.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4" class="admin-panel__empty">No members yet.</td>`;
    els.usersBody.appendChild(row);
    return;
  }

  for (const user of users) {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = user.name || "Unknown";

    const steamIdCell = document.createElement("td");
    steamIdCell.className = "admin-panel__steam-id";
    steamIdCell.textContent = user.steamId;

    const roleCell = document.createElement("td");
    const roleBadge = document.createElement("span");
    roleBadge.className = `admin-panel__role admin-panel__role--${user.role}`;
    roleBadge.textContent = user.role === "admin" ? "Administrator" : "User";
    roleCell.appendChild(roleBadge);

    const actionsCell = document.createElement("td");
    actionsCell.className = "admin-panel__actions";
    if (user.removable) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn--ghost btn--danger btn--small";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => void onRemoveUser(user));
      actionsCell.appendChild(removeButton);
    } else {
      actionsCell.textContent = "—";
    }

    row.append(nameCell, steamIdCell, roleCell, actionsCell);
    els.usersBody.appendChild(row);
  }
}

async function onAddUser(event) {
  event.preventDefault();
  const steamId = els.steamIdInput?.value.trim();
  if (!steamId) return;

  els.submitButton.disabled = true;
  setStatus("Adding user…");

  try {
    const user = await addManagedUser(steamId);
    await loadUsers();
    els.form?.reset();
    setStatus(`Added ${user.name || user.steamId}.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not add user", true);
  } finally {
    els.submitButton.disabled = false;
  }
}

async function onRemoveUser(user) {
  const label = user.name || user.steamId;
  if (!window.confirm(`Remove access for ${label}?`)) {
    return;
  }

  setStatus(`Removing ${label}…`);

  try {
    await removeManagedUser(user.steamId);
    await loadUsers();
    setStatus(`Removed ${label}.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not remove user", true);
  }
}
