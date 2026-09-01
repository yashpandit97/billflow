/** Read a form field as a trimmed string (FormData may yield File | null). */
export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
