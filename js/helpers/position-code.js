export function generatePositionCode(x, y) {
  const letterIndex = Math.min(Math.floor(x / 10), 25);
  const letter = String.fromCharCode(65 + letterIndex);
  const row = Math.min(Math.floor(y / 10), 9) + 1;
  const random = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `#${letter}${row}-${random}`;
}

export function roundCoord(value) {
  return Math.round(value * 10) / 10;
}
