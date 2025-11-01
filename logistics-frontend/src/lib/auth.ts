import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { signIn as signInAPI } from "@/services/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const resp = await signInAPI({
          // @ts-ignore
          email: credentials.email,
          // @ts-ignore
          password: credentials.password,
        });
        if (!resp.success || !resp.data) return null;
        const { user, access_token } = resp.data;
        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          access_token,
        } as any;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // @ts-ignore
        token.id = (user as any).id;
        // @ts-ignore
        token.access_token = (user as any).access_token;
      }
      return token as any;
    },
    async session({ session, token }) {
      if (session?.user) {
        // @ts-ignore
        (session.user as any).id = (token as any).id;
        // @ts-ignore
        (session.user as any).access_token = (token as any).access_token;
      }
      return session as any;
    },
  },
});

