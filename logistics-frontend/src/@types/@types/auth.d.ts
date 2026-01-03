import type { ScreenId } from "@/constants/screens";

type UserProfile = {
    id: number;
    name: string;
    permissions: ScreenId[];
    feature_permissions?: Partial<Record<ScreenId, string[]>>;
    is_default?: boolean;
}

type User = {
    id: number;
    name: string;
    email: string;
    is_superuser?: boolean;
    profile?: UserProfile | null;
    permissions?: ScreenId[];
}

/* API */
type APISignInResponse = {
    user: User;
    access_token: string
}

type APISignUpResponse = {
    user: User;
    access_token: string
}
