import NextAuth, { type DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";
import type { ScreenId } from "@/constants/screens";
import type { UserProfile } from "./auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: number;
            access_token: string;
            permissions?: ScreenId[];
            profile?: UserProfile | null;
            is_superuser?: boolean;
        } & DefaultSession['user']
    }

    interface User {
        id: number;
        name: string;
        email: string;
        access_token: string;
        is_superuser?: boolean;
        permissions?: ScreenId[];
        profile?: UserProfile | null;
        is_superuser?: boolean;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: number;
        access_token: string;
        permissions?: ScreenId[];
        profile?: UserProfile | null;
        is_superuser?: boolean;
    }
}
