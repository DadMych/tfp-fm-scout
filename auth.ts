import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { getDb } from "@/src/db/client.js";
import {
  createUser,
  findOAuthAccount,
  findUserByEmail,
  linkOAuthAccount,
  verifyPassword,
} from "@/src/db/auth-store.js";

function hostedAuthEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.AUTH_SECRET);
}

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...(process.env.AUTH_SECRET ? { secret: process.env.AUTH_SECRET } : {}),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        if (!hostedAuthEnabled()) return null;
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const db = getDb();
        if (!db) return null;

        const user = await findUserByEmail(db, parsed.data.email);
        if (!user?.passwordHash) return null;
        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name ?? null };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!hostedAuthEnabled() || !account || account.provider === "credentials") return true;

      const db = getDb();
      if (!db) return false;

      const email = (user.email ?? profile?.email)?.toLowerCase();
      if (!email) return false;

      const existing = await findOAuthAccount(db, account.provider, account.providerAccountId);
      if (existing) {
        user.id = existing.userId;
        return true;
      }

      let row = await findUserByEmail(db, email);
      if (!row) {
        row = await createUser(db, { email, name: user.name ?? null });
      }

      await linkOAuthAccount(db, {
        userId: row.id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        type: account.type,
      });

      user.id = row.id;
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});

export function isHostedAuthConfigured(): boolean {
  return hostedAuthEnabled();
}
