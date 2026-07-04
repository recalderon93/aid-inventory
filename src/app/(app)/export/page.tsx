import { redirect } from "next/navigation";

export default function ExportRedirectPage() {
  redirect("/users/export");
}
