export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC] p-4">
      {children}
    </div>
  );
}
