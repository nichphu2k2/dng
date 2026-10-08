export function normalizeThreeDigitId(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const number = Number(String(value).trim());
  if (!Number.isInteger(number) || number < 1 || number > 99999) {
    return null;
  }

  return String(number).padStart(5, "0");
}

export function getSmallestAvailableThreeDigitId(values = []) {
  const used = new Set(
    values
      .map((value) => normalizeThreeDigitId(value))
      .filter(Boolean)
      .map((value) => Number(value))
  );

  for (let number = 1; number <= 99999; number += 1) {
    if (!used.has(number)) {
      return String(number).padStart(5, "0");
    }
  }

  throw new Error("No available ID in 00001-99999 range");
}
