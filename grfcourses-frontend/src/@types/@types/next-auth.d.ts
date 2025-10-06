import NextAuth, { type DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
    interface Session {
        user: {
            id: number;
            access_token: string;
        } & DefaultSession['user']
    }

    interface User {
        id: number;
        name: string;
        email: string;
        access_token: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: number;
        access_token: string;
    }
}