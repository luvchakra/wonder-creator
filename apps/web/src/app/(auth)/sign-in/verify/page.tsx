import { Suspense } from "react";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "Two-step verification" };

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
