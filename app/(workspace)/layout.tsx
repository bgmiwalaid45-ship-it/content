
import DashboardSidebar from "@/app/components/DashboardSidebar";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full overflow-x-clip bg-[#080d19] text-white">
      <DashboardSidebar />

      <main className="min-w-0 w-full flex-1 px-4 pb-8 pt-20 sm:px-6 md:w-auto md:px-6 md:py-8 lg:p-10">
        <div className="mx-auto w-full min-w-0 max-w-[1600px]">
          {children}
        </div>
      </main>
    </div>
  );
}
