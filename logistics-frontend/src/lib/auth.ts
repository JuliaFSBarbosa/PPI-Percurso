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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // define ao autenticar (sign-in)
        // @ts-ignore
        token.id = (user as any).id;
        // @ts-ignore
        token.access_token = (user as any).access_token;
        // @ts-ignore
        token.name = (user as any).name ?? token.name;
        // @ts-ignore
        token.email = (user as any).email ?? token.email;
      }
      // trata atualizações via session.update no cliente
      if (trigger === "update" && session?.user) {
        // @ts-ignore
        token.name = (session.user as any).name ?? token.name;
        // @ts-ignore
        token.email = (session.user as any).email ?? token.email;
      }
      return token as any;
    },
    async session({ session, token }) {
      if (session?.user) {
        // @ts-ignore
        (session.user as any).id = (token as any).id;
        // @ts-ignore
        (session.user as any).access_token = (token as any).access_token;
        // também mantém name/email do token na sessão
        // @ts-ignore
        (session.user as any).name = (token as any).name ?? (session.user as any).name;
        // @ts-ignore
        (session.user as any).email = (token as any).email ?? (session.user as any).email;
      }
      return session as any;
    },
  },
});
