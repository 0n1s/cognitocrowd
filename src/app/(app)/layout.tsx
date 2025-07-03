
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
  Award,
  Users,
  Gift,
  Package,
  MessageCircle,
  Settings,
  LogOut,
  BarChart,
  Loader2,
  ClipboardList,
  Image,
  Video,
  Wallet,
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
import { getUserData } from "@/lib/database";
import { setupNewUser } from "@/lib/actions";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/dashboard", icon: LayoutGrid, label: "Dashboard" },
  { href: "/tasks", icon: ClipboardList, label: "Contributions" },
  { href: "/rewards", icon: Award, label: "Rewards" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
  { href: "/leaderboard", icon: Users, label: "Leaderboard" },
  { href: "/redeem", icon: Gift, label: "Redeem" },
  { href: "/packages", icon: Package, label: "Packages" },
];

const aiToolsNavItems = [
  { href: "/chat", icon: MessageCircle, label: "Chat Models" },
  { href: "#", icon: Image, label: "Image Models" },
  { href: "#", icon: Video, label: "Video Models" },
];


const AppHeader = () => {
  const { isMobile } = useSidebar();
  const { user } = useAuth();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
      {isMobile && <SidebarTrigger />}
      <div className="flex-1">
        <h1 className="font-headline text-lg font-semibold">Trainly</h1>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="text-right">
          <p className="font-semibold text-sm">{user?.displayName || "User"}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full">
              <Avatar>
                <AvatarImage src={user?.photoURL || `https://placehold.co/40x40.png`} alt={user?.displayName || "user"} />
                <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
              </Avatar>
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
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


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Wait until the auth state is fully loaded
    if (authLoading) {
      return;
    }

    // If there's no user, redirect to login page.
    if (!user) {
      router.push('/login');
      return;
    }

    // If there is a user, check their status in the database.
    async function checkUserStatus() {
        let userData = await getUserData(user!.uid);

        // If the user exists in Auth but not in our database, create the user record.
        if (!userData) {
            console.log("User data not found, attempting to create it...");
            await setupNewUser(user!.uid, user!.displayName || "New User", user!.email!);
            // Re-fetch the data after creation
            userData = await getUserData(user!.uid);
            
            // If it still fails, then there's a problem with setup. Log out.
            if (!userData) {
                router.push('/logout?reason=user_data_setup_failed');
                return;
            }
        }
        
        // If the user is an admin, grant immediate access.
        if (userData.role === 'super_user_alpha_7') {
            setIsAuthorized(true);
            return;
        }

        switch (userData.onboardingStatus) {
            case 'approved':
                // User is approved, allow access to the app.
                setIsAuthorized(true);
                break;
            case 'pending':
                // User is still pending, send them to the onboarding flow.
                router.push('/onboarding/welcome');
                break;
            case 'rejected':
                // User is rejected, log them out with a reason.
                router.push('/logout?reason=account_rejected');
                break;
            default:
                // Fallback for any other state is to log out to prevent loops.
                router.push('/logout?reason=user_data_not_found');
                break;
        }
    }

    checkUserStatus();
  }, [user, authLoading, router]);
  
  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href="/dashboard" className="flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-sidebar-primary"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            <span className="font-headline font-semibold text-lg text-sidebar-foreground">
              Trainly
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <SidebarSeparator className="my-2" />
          <div className="px-2">
            <div className="px-2 py-1 text-xs font-semibold text-sidebar-foreground/70">
                Our AI Tools
            </div>
          </div>
          <SidebarMenu>
            {aiToolsNavItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href) && item.href !== "#"}
                  tooltip={item.label}
                  disabled={item.href === "#"}
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
          <SidebarMenu>
            <SidebarMenuButton asChild tooltip="Admin Panel">
                <Link href="/admin/dashboard">
                    <BarChart />
                    <span>Admin Panel</span>
                </Link>
            </SidebarMenuButton>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="/settings">
                <Settings />
                <span>Settings</span>
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
          <AppHeader />
          <main className="flex-1 bg-background p-4 md:p-8 lg:p-10">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
