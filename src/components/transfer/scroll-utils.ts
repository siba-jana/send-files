/**
 * Scroll the transfer widget into view, compensating for the sticky header.
 * Shared by panels whose CTA buttons live below the fold after a reset.
 * Respects prefers-reduced-motion.
 */
export function scrollToTransfer(): void {
  if (typeof window === "undefined") return;
  const target = document.getElementById("transfer");
  if (!target) return;
  const top = target.getBoundingClientRect().top + window.scrollY - 80;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
}
