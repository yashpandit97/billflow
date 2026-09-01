import { redirect } from "next/navigation";

export default function AdminRiskRedirect() {
  redirect("/admin/subscriptions");
}
