import { localize } from "./constants.mjs";

const itemHTML = ({ id, label, heading }, current) => {
  if (heading) return `<li role="presentation" class="bookbinder-menu-heading">${label}</li>`;
  const active = id === current;
  return `<li><button type="button" role="menuitemradio" aria-checked="${active}" data-choice="${id}">`
    + `<i class="fa-solid fa-fw ${active ? "fa-check" : ""}"></i>${label}</button></li>`;
};

export function openMenu({ frame, anchor, items, current, onPick }) {
  frame.querySelector(".bookbinder-menu")?.remove();
  const menu = document.createElement("menu");
  menu.className = "bookbinder-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = items.map(item => itemHTML(item, current)).join("") || `<li class="bookbinder-menu-heading">${localize("Menu.Empty")}</li>`;
  const frameBox = frame.getBoundingClientRect(), anchorBox = anchor.getBoundingClientRect();
  menu.style.top = `${anchorBox.bottom - frameBox.top}px`;
  menu.style.right = `${frameBox.right - anchorBox.right}px`;
  const close = () => {
    menu.remove();
    anchor.ariaExpanded = "false";
  };
  menu.addEventListener("click", event => {
    const choice = event.target.closest("[data-choice]");
    if (!choice) return;
    close();
    onPick(choice.dataset.choice);
  });
  menu.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return anchor.focus();
    }
    const items = [...menu.querySelectorAll("button")];
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step || !items.length) return;
    event.preventDefault();
    items[(items.indexOf(document.activeElement) + step + items.length) % items.length].focus();
  });
  menu.addEventListener("focusout", event => {
    if (!menu.contains(event.relatedTarget) && event.relatedTarget !== anchor) close();
  });
  frame.append(menu);
  anchor.ariaExpanded = "true";
  (menu.querySelector("[aria-checked=true]") ?? menu.querySelector("button"))?.focus();
}

export function toggleMenu(options) {
  const open = options.frame.querySelector(".bookbinder-menu");
  if (open) open.remove();
  else openMenu(options);
}
