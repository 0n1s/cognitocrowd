
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
  Gauge,
  Coins,
  Trophy,
  Boxes,
  BotMessageSquare,
  SlidersHorizontal,
  DoorOpen,
  ChartNoAxesCombined,
  Loader2,
  ListChecks,
  Images,
  Clapperboard,
  WalletCards,
  AudioLines,
  Lock,
  Gem,
  Gift,
  Handshake,
  Landmark,
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
import { getPackage, getUserData } from "@/lib/database";
import { setupNewUser } from "@/lib/user-api";
import { ThemeToggle } from "@/components/theme-toggle";
import { SessionCurrencyPicker } from "@/components/session-currency-picker";
import type { Package as UserPackage } from "@/lib/types";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: Gauge, label: "Dashboard" },
  { href: "/tasks", icon: ListChecks, label: "Contributions" },
  { href: "/rewards", icon: Coins, label: "Rewards" },
  { href: "/referrals", icon: Gift, label: "Referrals" },
  { href: "/wallet", icon: WalletCards, label: "Wallet" },
  { href: "/partners", icon: Handshake, label: "Partners" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/packages", icon: Boxes, label: "Packages" },
  { href: "/partner-program", icon: Handshake, label: "Partner Program" },
  { href: "/partner", icon: Landmark, label: "Partner Portal" },
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
      <div className="flex items-center gap-2 sm:gap-4">
        <SessionCurrencyPicker />
        <ThemeToggle />
        <div className="hidden text-right sm:block">
          <p className="font-semibold text-sm">{user?.displayName || "User"}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full">
              <Avatar>
                <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "user"} />
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>('user');
  const [userPackage, setUserPackage] = useState<UserPackage | null>(null);
  const legacyTypes = userPackage?.allowedModelTypes || [];
  const hasLegacyType = (type: string) => legacyTypes.includes(type);
  const legacyFallbackEnabled = legacyTypes.length === 0;

  const allowChatNormal = (userPackage?.allowChatNormal ?? hasLegacyType('text')) || legacyFallbackEnabled;
  const allowChatUncensored = userPackage?.allowChatUncensored ?? hasLegacyType('uncensored');
  const allowChatCoding = userPackage?.allowChatCoding ?? hasLegacyType('coding');
  const allowChatHacking = userPackage?.allowChatHacking ?? hasLegacyType('hacking');

  const allowImageNormal = (userPackage?.allowImageNormal ?? hasLegacyType('image')) || legacyFallbackEnabled;
  const allowImageUncensored = userPackage?.allowImageUncensored ?? userPackage?.allowUncensoredImageGeneration ?? hasLegacyType('uncensored');

  const chatModes = [
    allowChatNormal ? 'Normal' : null,
    allowChatUncensored ? 'Uncensored' : null,
    allowChatCoding ? 'Coding' : null,
    allowChatHacking ? 'Hacking' : null,
  ].filter(Boolean) as string[];

  const imageModes = [
    allowImageNormal ? 'Normal' : null,
    allowImageUncensored ? 'Uncensored' : null,
  ].filter(Boolean) as string[];

  const chatEnabled = chatModes.length > 0;
  const imageEnabled = imageModes.length > 0;
  const videoEnabled = (userPackage?.allowVideoGeneration ?? hasLegacyType('video')) || legacyFallbackEnabled;
  const musicEnabled = (userPackage?.allowMusicGeneration ?? hasLegacyType('music')) || legacyFallbackEnabled;

  const imageLimit = userPackage?.imageGenerationLimit ?? 0;
  const videoLimit = userPackage?.videoGenerationLimit ?? 0;
  const musicLimit = userPackage?.musicGenerationLimit ?? 0;

  const imageDetail = !imageEnabled
    ? ''
    : imageLimit > 0
      ? `${imageModes.join(', ')} (${imageLimit} quota)`
      : `${imageModes.join(', ')} (no quota)`;

  const videoDetail = !videoEnabled
    ? ''
    : videoLimit > 0
      ? `Generation enabled (${videoLimit} quota)`
      : 'Generation enabled (no quota)';

  const musicDetail = !musicEnabled
    ? ''
    : musicLimit > 0
      ? `Generation enabled (${musicLimit} quota)`
      : 'Generation enabled (no quota)';

  const aiRows = [
    { key: 'chat', label: 'AI Chat', icon: BotMessageSquare, enabled: chatEnabled, detail: chatModes.join(', '), href: '/chat' },
    { key: 'image', label: 'Image Studio', icon: Images, enabled: imageEnabled, detail: imageDetail, href: '/image-generation' },
    { key: 'video', label: 'Video Studio', icon: Clapperboard, enabled: videoEnabled, detail: videoDetail, href: '/video-generation' },
    { key: 'music', label: 'Music Studio', icon: AudioLines, enabled: Boolean(musicEnabled), detail: musicDetail, href: '/music-generation' },
  ];

  const availableAiRows = aiRows.filter((row) => row.enabled);
  const lockedAiRows = aiRows.filter((row) => !row.enabled);
  const planRoute = '/packages';

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
            setIsAdmin(true);
          setUserRole(userData.role);
            setIsAuthorized(true);
            return;
        }

        setUserRole(userData.role || 'user');

        if (userData.packageId) {
          const pkg = await getPackage(userData.packageId);
          setUserPackage(pkg);
        } else {
          setUserPackage(null);
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

  const visibleNavItems = navItems.filter((item) => {
    if (item.href === '/partner') {
      return userRole === 'country_partner';
    }
    return true;
  });

  const isMainNavActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <SidebarProvider>
      <Sidebar className="border-r border-sidebar-border/60">
        <SidebarHeader>
          <Link href="/dashboard" className="group rounded-xl border border-sidebar-border/60 bg-sidebar-accent/30 px-3 py-2 transition-colors hover:bg-sidebar-accent/60">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-sidebar-primary"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              <span className="font-headline font-semibold text-lg text-sidebar-foreground">Trainly</span>
            </div>
            <p className="mt-1 text-xs text-sidebar-foreground/70">Contributor Workspace</p>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">Main</div>
          <SidebarMenu>
            {visibleNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isMainNavActive(item.href)}
                  tooltip={item.label}
                  className="h-10 rounded-lg border border-transparent px-2 data-[active=true]:border-sidebar-border data-[active=true]:bg-sidebar-accent/80 data-[active=true]:shadow-sm"
                >
                  <Link href={item.href}>
                    <span className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-foreground/70 transition-colors",
                      isMainNavActive(item.href) && "bg-sidebar-primary text-sidebar-primary-foreground"
                    )}>
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <SidebarSeparator className="my-2" />
          <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">AI Workspace</div>
          <SidebarMenu>
            {availableAiRows.map((row) => (
              <SidebarMenuItem key={row.key}>
                {row.href ? (
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(row.href)}
                    tooltip={row.label}
                    className="h-10 rounded-lg border border-transparent px-2 data-[active=true]:border-sidebar-border data-[active=true]:bg-sidebar-accent/80 data-[active=true]:shadow-sm"
                  >
                    <Link href={row.href}>
                      <span className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors",
                        pathname.startsWith(row.href) && "bg-primary text-primary-foreground"
                      )}>
                        <row.icon className="h-4 w-4" />
                      </span>
                      <span>{row.label}</span>
                    </Link>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton className="h-9 rounded-lg px-3" disabled>
                    <row.icon />
                    <span>{row.label}</span>
                    <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Enabled</span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            ))}
            {availableAiRows.length === 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton className="h-9 rounded-lg px-3 text-sidebar-foreground/60" disabled>
                  <Lock />
                  <span>No AI categories in your plan</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>

          {lockedAiRows.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">Locked In Your Plan</div>
              <SidebarMenu>
                {lockedAiRows.map((row) => (
                  <SidebarMenuItem key={`locked-${row.key}`}>
                    <SidebarMenuButton className="h-9 rounded-lg px-3 text-sidebar-foreground/70" disabled>
                      <row.icon />
                      <span>{row.label}</span>
                      <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Locked</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="h-9 rounded-lg px-3">
                    <Link href={planRoute}>
                      <Gem />
                      <span>Upgrade Plan</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </>
          )}
        </SidebarContent>
        <SidebarFooter>
          <SidebarSeparator className="mb-2" />
          <SidebarMenu>
            {isAdmin && (
                <SidebarMenuButton asChild tooltip="Admin Panel">
                    <Link href="/admin/dashboard">
                        <ChartNoAxesCombined />
                        <span>Admin Panel</span>
                    </Link>
                </SidebarMenuButton>
            )}
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="/settings">
                <SlidersHorizontal />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
            <SidebarMenuButton asChild tooltip="Logout">
              <Link href="/logout">
                <DoorOpen />
                <span>Logout</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AppHeader />
          <main className={cn(
            "min-h-0 flex-1 bg-background",
            pathname.startsWith('/chat') ? "overflow-hidden p-0 sm:p-4 md:p-6 lg:p-8" : "p-4 md:p-8 lg:p-10"
          )}>{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
