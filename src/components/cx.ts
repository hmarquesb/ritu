export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .map((part) => part.trim())
    .join(" ")
}
