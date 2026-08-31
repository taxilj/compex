import LoginPage from "../login/page";

// Customer registration is intentionally presented alongside sign-in so users
// can switch to the existing account flow without losing the registration UI.
// Reusing this component keeps validation, API handling, and verification
// messaging aligned with the established /auth/register contract.
export default function RegisterPage() {
  return <LoginPage />;
}
