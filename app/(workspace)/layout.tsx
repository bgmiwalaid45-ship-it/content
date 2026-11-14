
import DashboardSidebar from "@/app/components/DashboardSidebar";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#080d19] text-white">
      <DashboardSidebar />

      <main className="min-w-0 flex-1 p-6 lg:p-10">
        {children}
      </main>
    </div>
  );
}
