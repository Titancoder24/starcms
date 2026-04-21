import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import GitHub from "next-auth/providers/github";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { slugify } from "@/lib/util/slugify";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

function createRealDb() {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const db = createRealDb();

  return {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    providers: [
      Resend({
        from: process.env["EMAIL_FROM"] ?? "noreply@starcms.dev",
        sendVerificationRequest:
          process.env["NODE_ENV"] === "development"
            ? async ({ url }) => {
                console.log("\n=== Magic Link ===");
                console.log(url);
                console.log("==================\n");
              }
            : undefined,
      }),
      GitHub({
        clientId: process.env["GITHUB_ID"],
        clientSecret: process.env["GITHUB_SECRET"],
      }),
    ],
    callbacks: {
      session({ session, user }) {
        if (session.user) {
          session.user.id = user.id;
        }
        return session;
      },
    },
    events: {
      async createUser({ user }) {
        if (!user.id || !user.email) return;
        // Auto-create a personal site on first signup
        const existing = await db.query.sites.findFirst({
          where: (s) => eq(s.ownerId, user.id!),
        });
        if (!existing) {
          const emailLocal = user.email.split("@")[0] ?? "user";
          const siteName = `${emailLocal}'s site`;
          const siteSlug = slugify(emailLocal) + "-" + Date.now().toString(36);
          await db.insert(schema.sites).values({
            ownerId: user.id,
            name: siteName,
            slug: siteSlug,
          });
        }
      },
    },
    pages: {
      signIn: "/signin",
      error: "/signin",
    },
  };
});
