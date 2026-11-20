import type { Metadata } from "next";
import { AdminFarm } from "@/components/admin/farm";

export const metadata: Metadata = { title: "Granja" };

export default function Page() {
  return <AdminFarm />;
}
