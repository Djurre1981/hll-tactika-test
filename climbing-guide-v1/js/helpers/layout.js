export function isPhoneLayout() {
  return window.matchMedia("(max-width: 768px), (hover: none) and (pointer: coarse)").matches;
}
