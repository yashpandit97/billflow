import { redirect } from "next/navigation";

export default function AdminReconciliationRedirect() {
  redirect("/admin/subscriptions");
}
