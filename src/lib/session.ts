import { prisma } from "@/lib/db";

const GUEST_USER_ID = "guest-user-id";
const GUEST_USER_NAME = "Guest";
const GUEST_USER_EMAIL = "guest@cfcoach.dev";

export interface AppSession {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  expires: string;
}

function createGuestSession(userId = GUEST_USER_ID): AppSession {
  return {
    user: {
      id: userId,
      name: GUEST_USER_NAME,
      email: GUEST_USER_EMAIL,
      image: null,
    },
    expires: new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
}

export async function getAppSession(): Promise<AppSession> {
  const user = await prisma.user.upsert({
    where: { id: GUEST_USER_ID },
    update: {
      name: GUEST_USER_NAME,
      email: GUEST_USER_EMAIL,
      image: null,
    },
    create: {
      id: GUEST_USER_ID,
      name: GUEST_USER_NAME,
      email: GUEST_USER_EMAIL,
      image: null,
    },
  });

  return createGuestSession(user.id);
}

export const defaultSession = createGuestSession();
