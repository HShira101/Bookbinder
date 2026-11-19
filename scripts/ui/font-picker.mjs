import { escapeHTML, localize } from "../constants.mjs";
import { fontNames, hasFont } from "../theme/store.mjs";

const normalize = text => text.toLocaleLowerCase();

export function fontControl(value, { attribute = "data-font-open", clearable = true, extra = "" } = {}) {
  const missing = value && !hasFont(value);
  const label = value ? `${missing ? "⚠ " : ""}${escapeHTML(value)}` : clearable ? "—" : escapeHTML(localize("Editor.ChooseFont"));
  const manage = game.user.isGM ? `<button type="button" class="icon" data-fonts-manage aria-label="${localize("Fonts.Manage")}" data-tooltip="${localize("Fonts.Manage")}"><i class="fa-solid fa-gear"></i></button>` : "";
  return `<span class="bookbinder-font"><button type="button" ${attribute} ${extra} data-clearable="${clearable}" data-font="${escapeHTML(value ?? "")}"${missing ? ' class="missing"' : ""}><span data-font-name>${label}</span><i class="fa-solid fa-caret-down"></i></button>${manage}</span>`;
}

export function drawFontNames(root) {
  root.querySelectorAll("[data-font-name]").forEach(node => {
    const name = node.closest("[data-font]")?.dataset.font;
    node.style.fontFamily = name ? `"${name}", var(--font-body, sans-serif)` : "";
  });
}

export function manageFonts(onClose) {
  const app = new foundry.applications.settings.menus.FontConfig();
  app.addEventListener("close", () => onClose?.(), { once: true });
  return app.render({ force: true });
}

function openPicker({ anchor, current, clearable, onPick }) {
  document.querySelector(".bookbinder-font-popup")?.remove();
  const popup = document.createElement("div");
  popup.className = "bookbinder-font-popup";
  popup.innerHTML = `<input type="search" autocomplete="off" placeholder="${escapeHTML(localize("Fonts.Search"))}"><ul role="listbox"></ul>`;
  const list = popup.querySelector("ul"), search = popup.querySelector("input");
  const names = fontNames();
  let shown = [], active = 0;
  const close = () => {
    popup.remove();
    document.removeEventListener("pointerdown", outside, true);
  };
  const outside = event => {
    if (!popup.contains(event.target) && !anchor.contains(event.target)) close();
  };
  const pick = value => {
    close();
    onPick(value);
  };
  const draw = () => {
    const query = normalize(search.value.trim());
    shown = [...(clearable && !query ? [""] : []), ...names.filter(name => normalize(name).includes(query))];
    active = Math.max(0, Math.min(active, shown.length - 1));
    list.replaceChildren(...shown.map((name, index) => {
      const item = document.createElement("li");
      item.setAttribute("role", "option");
      item.dataset.value = name;
      item.textContent = name || "—";
      if (name) item.style.fontFamily = `"${name}", var(--font-body, sans-serif)`;
      item.classList.toggle("active", index === active);
      item.ariaSelected = String(name === (current ?? ""));
      return item;
    }));
    list.children[active]?.scrollIntoView({ block: "nearest" });
    if (!shown.length) list.innerHTML = `<li class="empty">${localize("Fonts.None")}</li>`;
  };
  const move = step => {
    active = (active + step + shown.length) % shown.length;
    draw();
  };
  search.addEventListener("input", () => {
    active = 0;
    draw();
  });
  search.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") move(1);
    else if (event.key === "ArrowUp") move(-1);
    else if (event.key === "Enter" && shown.length) pick(shown[active]);
    else if (event.key === "Escape") {
      event.stopPropagation();
      close();
      anchor.focus();
    } else return;
    event.preventDefault();
  });
  list.addEventListener("click", event => {
    const item = event.target.closest("[data-value]");
    if (item) pick(item.dataset.value);
  });
  document.body.append(popup);
  const box = anchor.getBoundingClientRect();
  popup.style.left = `${Math.min(box.left, window.innerWidth - popup.offsetWidth - 8)}px`;
  popup.style.top = `${Math.min(box.bottom + 2, window.innerHeight - popup.offsetHeight - 8)}px`;
  popup.style.minWidth = `${box.width}px`;
  active = Math.max(0, names.indexOf(current) + (clearable ? 1 : 0));
  draw();
  document.addEventListener("pointerdown", outside, true);
  search.focus();
}

export function handleFontClick(event, { onPick, refresh }) {
  const open = event.target.closest("[data-font-open]");
  if (open) openPicker({ anchor: open, current: open.dataset.font, clearable: open.dataset.clearable === "true", onPick: value => onPick(open, value) });
  else if (event.target.closest("[data-fonts-manage]")) manageFonts(refresh);
  return Boolean(open) || Boolean(event.target.closest("[data-fonts-manage]"));
}
