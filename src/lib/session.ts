import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getAppSession() {
  return getServerSession(authOptions);
}
