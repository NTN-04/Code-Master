// Utils: sanitize and escaping helpers
export function sanitizeText(text) {
  if (text === null || text === undefined) return "";
  const str = String(text);
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "/": "&#x2F;",
  };
  return str.replace(/[&<>"'/]/g, (m) => map[m]);
}

export function safeSetText(el, text) {
  if (!el) return;
  el.textContent = text ?? "";
}

export function safeSetHTMLWithIcons(
  el,
  plainTextBeforeIcon,
  iconClass,
  plainTextAfterIcon = ""
) {
  if (!el) return;
  const before = sanitizeText(plainTextBeforeIcon || "");
  const after = sanitizeText(plainTextAfterIcon || "");
  el.innerHTML = `<i class="${iconClass}"></i> ${before}${
    after ? " " + after : ""
  }`;
}
