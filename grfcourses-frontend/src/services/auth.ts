import { SignInForm } from "@/schemas/auth";

export const signIn = async(data: SignInForm) => {
    return api<APISignInResponse>({
        endpoint: "/accounts/signin/",
        method: "POST",
        data
    })
}