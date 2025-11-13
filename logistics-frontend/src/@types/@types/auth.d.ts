type User = {
    id: number;
    name: string;
    email: string;
    is_superuser?: boolean;
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
