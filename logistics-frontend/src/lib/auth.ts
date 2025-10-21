import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        // TODO: integrar com API real. Por enquanto, aceita qualquer par não-vazio.
        return {
          id: "1",
          name: "Usuário",
          email: credentials.email as string,
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
      }
      return token as any;
    },
    async session({ session, token }) {
      if (session?.user) {
        // @ts-ignore
        (session.user as any).id = (token as any).id;
      }
      return session as any;
    },
  },
});

