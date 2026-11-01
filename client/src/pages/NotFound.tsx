import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { buttonClass } from "@/components/button-styles";
import { useAuth, homeFor } from "@/lib/auth-context";

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Compass className="h-7 w-7" />
      </div>
      <h1 className="mt-6 text-3xl font-extrabold">Page not found</h1>
      <p className="mt-2 max-w-sm text-slate-500">The page you're looking for doesn't exist or has moved.</p>
      <Link to={user ? homeFor(user.role) : "/"} className={buttonClass("primary", "md", "mt-6")}>
        {user ? "Back to dashboard" : "Go home"}
      </Link>
    </div>
  );
}
