export const ROLE_ORDER = { owner: 0, admin: 1, assist: 2, editor: 3, viewer: 4 };
export const ROLE_LABELS = {
  owner: "Owner",
  admin: "Comp Admin",
  assist: "Comp Assist",
  editor: "Comp Advisor",
  viewer: "Comp Member",
};
export const ASSIGNABLE_ROLES = ["viewer", "editor", "assist", "admin"];

let openRolePicker = null;
let rolePickerDismissAbort = null;

function getRolePickerListWrap(picker) {
  return picker._rolePickerListWrap || picker.querySelector(".admin-role-picker__list-wrap");
}

export function closeRolePicker(picker = openRolePicker) {
  if (!picker) return;

  const wrap = getRolePickerListWrap(picker);
  picker.classList.remove("is-open");
  picker.querySelector(".admin-role-picker__chevron")?.setAttribute("aria-expanded", "false");
  if (wrap) {
    wrap.classList.remove("is-open");
    wrap.style.top = "";
    wrap.style.left = "";
    wrap.style.width = "";
    if (wrap.parentElement) {
      const parent = wrap.parentElement;
      parent.removeChild(wrap);
      picker.appendChild(wrap);
    }
    delete picker._rolePickerListWrap;
  }
  if (openRolePicker === picker) {
    openRolePicker = null;
  }
}

export function positionRolePickerList(picker, panelEl) {
  const wrap = getRolePickerListWrap(picker);
  if (!wrap || !panelEl) return;

  const dialogRect = panelEl.getBoundingClientRect();
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

export function bindRolePickerDismiss(panelEl) {
  rolePickerDismissAbort?.abort();
  rolePickerDismissAbort = new AbortController();
  const { signal } = rolePickerDismissAbort;

  document.addEventListener(
    "click",
    (event) => {
      if (!openRolePicker) return;

      const wrap = getRolePickerListWrap(openRolePicker);
      const clickedInsidePicker = openRolePicker.contains(event.target);
      const clickedInsideList = wrap?.contains(event.target);
      if (!clickedInsidePicker && !clickedInsideList) {
        closeRolePicker();
      }
    },
    { signal }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeRolePicker();
      }
    },
    { signal }
  );

  window.addEventListener(
    "resize",
    () => {
      if (openRolePicker) {
        positionRolePickerList(openRolePicker, panelEl);
      }
    },
    { signal }
  );

  const tableBody = panelEl?.querySelector(".admin-panel__table tbody");
  tableBody?.addEventListener(
    "scroll",
    () => {
      if (openRolePicker) {
        positionRolePickerList(openRolePicker, panelEl);
      }
    },
    { signal }
  );
}

export function unbindRolePickerDismiss() {
  rolePickerDismissAbort?.abort();
  rolePickerDismissAbort = null;
}

export function openRolePickerMenu(picker, panelEl) {
  if (openRolePicker && openRolePicker !== picker) {
    closeRolePicker();
  }

  const wrap = picker.querySelector(".admin-role-picker__list-wrap");
  if (!wrap) return;

  panelEl.appendChild(wrap);
  picker._rolePickerListWrap = wrap;

  picker.classList.add("is-open");
  wrap.classList.add("is-open");
  picker.querySelector(".admin-role-picker__chevron")?.setAttribute("aria-expanded", "true");
  positionRolePickerList(picker, panelEl);
  openRolePicker = picker;
}

export function toggleRolePicker(picker, panelEl) {
  if (picker.classList.contains("is-open")) {
    closeRolePicker(picker);
  } else {
    openRolePickerMenu(picker, panelEl);
  }
}

export function setRolePickerValue(picker, role) {
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

export function createRolePicker(user, panelEl, onRoleChange) {
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
    toggleRolePicker(picker, panelEl);
  });

  summary?.addEventListener("click", () => openRolePickerMenu(picker, panelEl));
  summary?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleRolePicker(picker, panelEl);
    }
  });

  setRolePickerValue(picker, user.role);
  return picker;
}

export function dismissUserMenu(openButton) {
  const wrap = openButton?.closest(".user-cluster__avatar-wrap");
  wrap?.classList.add("is-menu-dismissed");
  document.activeElement?.blur();
}
