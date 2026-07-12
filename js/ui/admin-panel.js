import {
  addManagedUser,
  fetchManagedUsers,
  removeManagedUser,
  updateManagedUserRole,
} from "../api/admin.js";
import { getCurrentUser } from "../api/auth.js";

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
};

const ROLE_ORDER = { owner: 0, admin: 1, assist: 2, editor: 3, viewer: 4 };
const ROLE_LABELS = {
  owner: "Owner",
  admin: "Comp Admin",
  assist: "Comp Assist",
  editor: "Comp Advisor",
  viewer: "Comp Member",
};
const ASSIGNABLE_ROLES = ["viewer", "editor", "assist", "admin"];

let users = [];
let currentUser = null;
let openRolePicker = null;

export function initAdminPanel() {
  currentUser = getCurrentUser();
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "owner") || !els.panel) {
    return;
  }

  if (currentUser.role === "owner" && els.headerNote) {
    els.headerNote.textContent =
      "Add or remove circle members. Owners can change roles and remove administrators.";
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
  bindRolePickerDismiss();
}

function closeRolePicker(picker = openRolePicker) {
  if (!picker) return;

  const wrap = picker.querySelector(".admin-role-picker__list-wrap")
    || picker._rolePickerListWrap;
  picker.classList.remove("is-open");
  picker.querySelector(".admin-role-picker__chevron")?.setAttribute("aria-expanded", "false");
  if (wrap) {
    wrap.classList.remove("is-open");
    wrap.style.top = "";
    wrap.style.left = "";
    wrap.style.width = "";
    if (wrap.parentElement === els.panel) {
      picker.appendChild(wrap);
    }
    delete picker._rolePickerListWrap;
  }
  if (openRolePicker === picker) {
    openRolePicker = null;
  }
}

function getRolePickerListWrap(picker) {
  return picker._rolePickerListWrap || picker.querySelector(".admin-role-picker__list-wrap");
}

function positionRolePickerList(picker) {
  const wrap = getRolePickerListWrap(picker);
  if (!wrap || !els.panel) return;

  const dialogRect = els.panel.getBoundingClientRect();
  const rect = picker.getBoundingClientRect();
  const listHeight = wrap.offsetHeight;
  const spaceBelow = dialogRect.bottom - rect.bottom - 8;
  const spaceAbove = rect.top - dialogRect.top - 8;
  const openBelow = spaceBelow >= listHeight || spaceBelow >= spaceAbove;

  wrap.style.width = `${rect.width}px`;
  wrap.style.left = `${rect.left - dialogRect.left}px`;
  wrap.style.top = openBelow
    ? `${rect.bottom - dialogRect.top + 4}px`
    : `${rect.top - dialogRect.top - listHeight - 4}px`;
}

function bindRolePickerDismiss() {
  document.addEventListener("click", (event) => {
    if (!openRolePicker) return;

    const wrap = getRolePickerListWrap(openRolePicker);
    const clickedInsidePicker = openRolePicker.contains(event.target);
    const clickedInsideList = wrap?.contains(event.target);
    if (!clickedInsidePicker && !clickedInsideList) {
      closeRolePicker();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeRolePicker();
    }
  });

  window.addEventListener("resize", () => {
    if (openRolePicker) {
      positionRolePickerList(openRolePicker);
    }
  });

  const tableBody = els.panel?.querySelector(".admin-panel__table tbody");
  tableBody?.addEventListener("scroll", () => {
    if (openRolePicker) {
      positionRolePickerList(openRolePicker);
    }
  });
}

function openRolePickerMenu(picker) {
  if (openRolePicker && openRolePicker !== picker) {
    closeRolePicker();
  }

  const wrap = picker.querySelector(".admin-role-picker__list-wrap");
  if (!wrap) return;

  els.panel.appendChild(wrap);
  picker._rolePickerListWrap = wrap;

  picker.classList.add("is-open");
  wrap.classList.add("is-open");
  picker.querySelector(".admin-role-picker__chevron")?.setAttribute("aria-expanded", "true");
  positionRolePickerList(picker);
  openRolePicker = picker;
}

function toggleRolePicker(picker) {
  if (picker.classList.contains("is-open")) {
    closeRolePicker(picker);
  } else {
    openRolePickerMenu(picker);
  }
}

function setRolePickerValue(picker, role) {
  const label = picker.querySelector(".admin-role-picker__label");
  if (label) {
    label.textContent = ROLE_LABELS[role] || role;
  }

  picker.querySelectorAll(".admin-role-picker__option").forEach((option) => {
    const isSelected = option.dataset.value === role;
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
}

function createRolePicker(user) {
  const picker = document.createElement("div");
  picker.className = "admin-role-picker";
  picker.innerHTML = `
    <button type="button" class="admin-role-picker__chevron" aria-label="Change role" aria-expanded="false"></button>
    <div class="admin-role-picker__summary" tabindex="0" role="button" aria-haspopup="listbox">
      <span class="admin-role-picker__label"></span>
    </div>
    <div class="admin-role-picker__list-wrap">
      <ul class="admin-role-picker__list" role="listbox"></ul>
    </div>
  `;

  const list = picker.querySelector(".admin-role-picker__list");
  for (const role of ASSIGNABLE_ROLES) {
    const option = document.createElement("li");
    option.className = "admin-role-picker__option";
    option.role = "option";
    option.dataset.value = role;
    option.textContent = ROLE_LABELS[role];
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      if (role === user.role) {
        closeRolePicker(picker);
        return;
      }
      closeRolePicker(picker);
      void onRoleChange(user, role, picker);
    });
    list.appendChild(option);
  }

  const chevron = picker.querySelector(".admin-role-picker__chevron");
  const summary = picker.querySelector(".admin-role-picker__summary");

  chevron?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleRolePicker(picker);
  });

  summary?.addEventListener("click", () => openRolePickerMenu(picker));
  summary?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleRolePicker(picker);
    }
  });

  setRolePickerValue(picker, user.role);
  return picker;
}

function dismissUserMenu() {
  const wrap = els.openButton?.closest(".user-cluster__avatar-wrap");
  wrap?.classList.add("is-menu-dismissed");
  document.activeElement?.blur();
}

function openPanel() {
  dismissUserMenu();
  els.panel?.showModal();
  setStatus("");
  void loadUsers();
}

function closePanel() {
  closeRolePicker();
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
    return createRolePicker(user);
  }

  const roleBadge = document.createElement("span");
  roleBadge.className = `admin-panel__role admin-panel__role--${user.role}`;
  roleBadge.textContent = ROLE_LABELS[user.role] || user.role;
  return roleBadge;
}

function renderUsers() {
  if (!els.usersBody) return;

  closeRolePicker();
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
    nameCell.textContent = user.name || "—";

    const steamIdCell = document.createElement("td");
    steamIdCell.className = "admin-panel__steam-id";
    steamIdCell.textContent = user.steamId;

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
