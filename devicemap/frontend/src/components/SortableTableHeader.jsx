export const compareText = (left, right) =>
  String(left || "").localeCompare(String(right || ""), undefined, { sensitivity: "base" });

export const compareThreeDigitId = (left, right) =>
  Number.parseInt(String(left || "0"), 10) - Number.parseInt(String(right || "0"), 10);

export default function SortableTableHeader({ title }) {
  return <span>{title}</span>;
}
