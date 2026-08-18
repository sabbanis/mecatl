import { redirect } from "next/navigation";
import { verifySession } from "@/lib/authz";

export default async function Home() {
  await verifySession();
  redirect("/workspace/chat");
}
