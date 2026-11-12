import { site } from "@/lib/site";
import { LoginForm } from "./login-form";

export default function OpsLoginPage() {
  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="font-display text-2xl font-bold">Staff sign in</h1>
      <p className="text-muted text-sm mt-1">For {site.name} staff only.</p>
      <LoginForm />
    </div>
  );
}
