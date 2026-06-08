/**
 * Returns dynamic collision padding to ensure popper dropdowns/selects
 * do not overlap with the bottom navigation tabs when they are docked.
 */
export function getCollisionPadding(): number {
  const defaultPadding = 8;

  if (typeof document === "undefined" || typeof window === "undefined") {
    return defaultPadding;
  }

  const tabList = document.querySelector('[role="tablist"][aria-label="Inspector"]');
  if (tabList) {
    const rect = tabList.getBoundingClientRect();
    const isDockedAtBottom = Math.abs(rect.bottom - window.innerHeight) < 5;
    if (isDockedAtBottom) {
      return Math.round(rect.height) + 8;
    }
  }

  return defaultPadding;
}
