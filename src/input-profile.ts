// Width is a layout hint; pointer/hover capability avoids classifying a small PC window as a phone.
export function useTouchControls(width: number, coarsePointer: boolean, canHover: boolean): boolean {
  return width <= 1024 && (coarsePointer || !canHover);
}
