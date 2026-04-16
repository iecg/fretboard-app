export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => {
    // Check if the element itself or any ancestor within the container has aria-hidden or inert
    const hiddenAncestor = el.closest('[aria-hidden="true"], [inert]');
    // Exclude if a hidden/inert ancestor exists and is within (or is) the container
    return !hiddenAncestor || !container.contains(hiddenAncestor);
  });
}