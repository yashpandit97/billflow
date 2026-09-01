/** Payment status defaults for bill finalization. */
export function defaultPaymentStatus(
  method: string | null | undefined
): "pending" | "paid" {
  if (method === "cash" || method === "card") return "paid";
  return "pending";
}
