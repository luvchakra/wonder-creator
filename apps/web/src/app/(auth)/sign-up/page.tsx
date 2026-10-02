import { Suspense } from "react";
import { googleSignInEnabled } from "@/lib/auth-providers";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Create your account" };

export default async function SignUpPage() {
  const google = await googleSignInEnabled();
  return (
    <Suspense>
      <AuthForm mode="sign-up" google={google} />
    </Suspense>
  );
}
