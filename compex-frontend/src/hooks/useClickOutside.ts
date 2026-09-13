import { useEffect, type RefObject } from "react";

/**
 * Calls `onOutside` when a mousedown lands outside `ref`'s element, but only
 * while `active` is true. Used by the header's dropdown menus (categories,
 * manufacturers, resources) so each can share the same close-on-outside-click
 * behavior instead of duplicating a listener per menu.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [ref, onOutside, active]);
}
