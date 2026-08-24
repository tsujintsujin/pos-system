import { redirect } from "next/navigation";

export default function Home() {
  // proxy.ts already ensures only authenticated requests reach here.
  redirect("/dashboard");
}
