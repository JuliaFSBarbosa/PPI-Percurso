"use server";

import { loginSchema } from "@/schemas/auth";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export type LoginFormState = {
  fieldErrors?: {
    email?: string;
    password?: string;
  };
  error?: string;
  success?: boolean;
};

export async function loginAction(_: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        email: f.email?.[0],
        password: f.password?.[0],
      },
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/inicio",
    });
    return { success: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Email e/ou senha inválidos." };
    }
    throw e;
  }
}

