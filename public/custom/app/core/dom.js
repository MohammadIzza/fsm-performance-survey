export function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
    return;
  }

  callback();
}

export function selectAll(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}
