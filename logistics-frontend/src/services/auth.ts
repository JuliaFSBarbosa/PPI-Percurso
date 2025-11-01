import { SignInForm } from "@/schemas/auth";
import { api } from "@/lib/api";

export const signIn = async (data: SignInForm) => {
  return api<APISignInResponse>({
    endpoint: "/accounts/signin/",
    method: "POST",
    data,
    withAuth: false,
  });
};
