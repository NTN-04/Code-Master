// Utils: DOM rendering helpers
export function createFragment(children = []) {
  const frag = document.createDocumentFragment();
  for (const node of children) {
    if (node) frag.appendChild(node);
  }
  return frag;
}

export function clearNode(node) {
  if (!node) return;
  node.textContent = "";
}

export function lazyImage(src, alt = "", fallback = "", attrs = {}) {
  const img = document.createElement("img");
  img.loading = "lazy";
  img.src = src || fallback || "";
  img.alt = alt;
  if (fallback) {
    img.onerror = function () {
      this.src = fallback;
    };
  }
  for (const [k, v] of Object.entries(attrs)) {
    try {
      img.setAttribute(k, v);
    } catch {}
  }
  return img;
}

export function batchAppend(parent, nodes) {
  if (!parent) return;
  const frag = createFragment(nodes);
  parent.appendChild(frag);
}

// Simple debounce utility for UI updates
export function debounce(fn, delay = 100) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
