
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  LayoutGrid,
  ClipboardList,
  LogOut,
  ArrowLeft,
  Loader2,
  Package,
  Users,
  Settings,
  Banknote,
  HandCoins,
  FileQuestion,
  UserCheck,
  GalleryHorizontal,
  Landmark,
  Mail,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { getUserData } from "@/lib/database";

const navItems = [
  { href: "/admin/dashboard", icon: LayoutGrid, label: "Dashboard" },
  { href: "/admin/tasks", icon: ClipboardList, label: "Contributions" },
  { href: "/admin/packages", icon: Package, label: "Packages" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/partners", icon: Landmark, label: "Country Partners" },
  { href: "/admin/withdrawals", icon: Banknote, label: "Withdrawals" },
  { href: "/admin/deposits", icon: HandCoins, label: "Deposits" },
  { href: "/admin/qualifications", icon: FileQuestion, label: "Qualifications" },
  { href: "/admin/approvals", icon: UserCheck, label: "Approvals" },
  { href: "/admin/landing", icon: GalleryHorizontal, label: "Landing Page" },
  { href: "/admin/email-logs", icon: Mail, label: "Email Logs" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

const AdminHeader = () => {
  const { isMobile } = useSidebar();
  const { user } = useAuth();
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "AD";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
      {isMobile && <SidebarTrigger />}
      <div className="flex-1">
        <h1 className="font-headline text-lg font-semibold">Admin Panel</h1>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full">
              <Avatar>
                <AvatarImage src={user?.photoURL || `https://placehold.co/40x40.png`} alt={user?.displayName || "admin"} />
                <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
              </Avatar>
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.displayName || "Admin Account"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/logout">Logout</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.push('/login');
      return;
    }

    // User is logged in, check their role from Firestore
    getUserData(user.uid).then(userData => {
      if (userData?.role === 'super_user_alpha_7') {
        setIsAuthorized(true);
      } else {
        // Not an admin, redirect to user dashboard
        router.push('/dashboard');
      }
    });

  }, [user, authLoading, router]);

  if (authLoading || !isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }


  return (
    <SidebarProvider>
      <Sidebar className="border-r border-sidebar-border/60">
        <SidebarHeader>
          <Link href="/admin/dashboard" className="group rounded-xl border border-sidebar-border/60 bg-sidebar-accent/30 px-3 py-2 transition-colors hover:bg-sidebar-accent/60">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-sidebar-primary"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              <span className="font-headline font-semibold text-lg text-sidebar-foreground">TrainlyLabs</span>
            </div>
            <p className="mt-1 text-xs text-sidebar-foreground/70">Admin Control Center</p>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">Management</div>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={item.label}
                  className="h-9 rounded-lg border border-transparent px-3 data-[active=true]:border-sidebar-border data-[active=true]:bg-sidebar-accent/80 data-[active=true]:shadow-sm"
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarSeparator className="mb-2" />
          <SidebarMenu>
            <SidebarMenuButton asChild tooltip="Back to App">
              <Link href="/dashboard">
                  <ArrowLeft />
                  <span>Back to App</span>
              </Link>
            </SidebarMenuButton>
            <SidebarMenuButton asChild tooltip="Logout">
              <Link href="/logout">
                <LogOut />
                <span>Logout</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AdminHeader />
          <main className="flex-1 bg-background p-4 md:p-8 lg:p-10">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
