import { Suspense } from "react";
import { googleSignInEnabled } from "@/lib/auth-providers";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  const google = await googleSignInEnabled();
  return (
    <Suspense>
      <AuthForm mode="sign-in" google={google} />
    </Suspense>
  );
}
