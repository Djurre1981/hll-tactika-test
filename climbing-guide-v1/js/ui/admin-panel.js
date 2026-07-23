import {
  addManagedUser,
  fetchFullPinsExport,
  fetchManagedUsers,
  removeManagedUser,
  testDiscordAlert,
  updateManagedUserRole,
} from "../api/admin.js";
import { getCurrentUser } from "../api/auth.js";
import {
  ROLE_ORDER,
  ROLE_LABELS,
  closeRolePicker,
  bindRolePickerDismiss,
  unbindRolePickerDismiss,
  createRolePicker,
  setRolePickerValue,
  dismissUserMenu,
} from "./role-picker.js";

const els = {
  panel: document.getElementById("admin-panel"),
  openButton: document.getElementById("btn-admin-panel"),
  closeButton: document.getElementById("btn-close-admin-panel"),
  form: document.getElementById("admin-add-user-form"),
  steamIdInput: document.getElementById("admin-steam-id"),
  usersBody: document.getElementById("admin-users-body"),
  status: document.getElementById("admin-panel-status"),
  submitButton: document.getElementById("btn-admin-add-user"),
  headerNote: document.querySelector(".admin-panel__header p"),
  exportSection: document.getElementById("admin-export-section"),
  exportButton: document.getElementById("btn-admin-export-pins"),
  alertTestButton: document.getElementById("btn-admin-alert-test"),
};

let users = [];
let currentUser = null;

export function initAdminPanel() {
  currentUser = getCurrentUser();
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "owner") || !els.panel) {
    return;
  }

  if (currentUser.role === "owner" && els.headerNote) {
    els.headerNote.textContent =
      "Add or remove circle members. Owners can change roles and remove administrators.";
    els.exportSection?.classList.remove("hidden");
    els.exportButton?.addEventListener("click", onExportPins);
    els.alertTestButton?.addEventListener("click", onAlertTest);
  }

  els.openButton?.classList.remove("hidden");
  els.openButton?.addEventListener("click", openPanel);

  const avatarWrap = els.openButton?.closest(".user-cluster__avatar-wrap");
  avatarWrap?.addEventListener("mouseleave", () => {
    avatarWrap.classList.remove("is-menu-dismissed");
  });

  els.closeButton?.addEventListener("click", closePanel);
  els.panel?.addEventListener("click", (event) => {
    if (event.target === els.panel) {
      closePanel();
    }
  });
  els.form?.addEventListener("submit", onAddUser);
}

function openPanel() {
  dismissUserMenu(els.openButton);
  bindRolePickerDismiss(els.panel);
  els.panel?.showModal();
  setStatus("");
  void loadUsers();
}

function closePanel() {
  closeRolePicker();
  unbindRolePickerDismiss();
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
      const roleDiff = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
      if (roleDiff !== 0) {
        return roleDiff;
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

function renderRoleCell(user) {
  if (user.roleEditable) {
    return createRolePicker(user, els.panel, onRoleChange);
  }

  const roleBadge = document.createElement("span");
  roleBadge.className = `admin-panel__role admin-panel__role--${user.role}`;
  roleBadge.textContent = ROLE_LABELS[user.role] || user.role;
  return roleBadge;
}

function formatLastLoginLabel(iso) {
  if (!iso) return "Last login: unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Last login: unknown";
  return `Last login: ${date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

function syncTableScrollHeight(rowCount = users.length) {
  const tableWrap = els.panel?.querySelector(".admin-panel__table-wrap");
  if (!tableWrap) return;
  const visibleRows = Math.min(Math.max(rowCount, 1), 10);
  tableWrap.style.setProperty("--admin-table-visible-rows", String(visibleRows));
  if (currentUser?.role === "owner") {
    tableWrap.style.setProperty("--admin-table-row-height", "3.55rem");
  }
}

function renderUsers() {
  if (!els.usersBody) return;

  closeRolePicker();
  els.usersBody.innerHTML = "";

  if (users.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4" class="admin-panel__empty">No members yet.</td>`;
    els.usersBody.appendChild(row);
    syncTableScrollHeight(1);
    return;
  }

  for (const user of users) {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = user.name || "—";

    const steamIdCell = document.createElement("td");
    steamIdCell.className = "admin-panel__steam-id";
    const steamIdValue = document.createElement("div");
    steamIdValue.className = "admin-panel__steam-id-value";
    steamIdValue.textContent = user.steamId;
    steamIdCell.appendChild(steamIdValue);
    // Owner-only: API only includes lastSignedInAt for owners
    if (currentUser?.role === "owner") {
      const lastLogin = document.createElement("div");
      lastLogin.className = "admin-panel__last-login";
      lastLogin.textContent = formatLastLoginLabel(user.lastSignedInAt);
      steamIdCell.appendChild(lastLogin);
    }

    const roleCell = document.createElement("td");
    roleCell.appendChild(renderRoleCell(user));

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

  syncTableScrollHeight(users.length);
}

async function onRoleChange(user, newRole, picker) {
  if (newRole === user.role) {
    return;
  }

  const label = user.name || user.steamId;
  const previousRole = user.role;
  picker?.classList.add("is-disabled");
  setStatus(`Updating role for ${label}…`);

  try {
    const updated = await updateManagedUserRole(user.steamId, newRole);
    user.role = updated.role;
    user.removable = updated.removable;
    user.roleEditable = updated.roleEditable;
    user.name = updated.name || user.name;
    setRolePickerValue(picker, updated.role);
    await loadUsers();
    setStatus(`Updated ${label} to ${ROLE_LABELS[newRole]}.`);
  } catch (error) {
    console.error(error);
    setRolePickerValue(picker, previousRole);
    setStatus(error.message || "Could not update role", true);
  } finally {
    picker?.classList.remove("is-disabled");
  }
}

async function onExportPins() {
  els.exportButton.disabled = true;
  setStatus("Preparing backup…");

  try {
    const data = await fetchFullPinsExport();
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pins-d1-backup-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`D1 backup downloaded (${data.pinCount ?? "?"} pins).`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not export pins", true);
  } finally {
    els.exportButton.disabled = false;
  }
}

async function onAlertTest() {
  if (!els.alertTestButton) return;
  els.alertTestButton.disabled = true;
  setStatus("Sending Discord probe…");

  try {
    const result = await testDiscordAlert();
    if (result.ok) {
      const count = result.sent || result.webhookCount || 1;
      setStatus(
        count > 1
          ? `Discord probe sent to ${count} webhooks.`
          : "Discord probe sent. Check your alert channel."
      );
    } else {
      setStatus(
        result.error || `Discord probe failed (${result.discordStatus ?? result.httpStatus})`,
        true
      );
    }
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Alert test failed", true);
  } finally {
    els.alertTestButton.disabled = false;
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
