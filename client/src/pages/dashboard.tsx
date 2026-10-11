import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  History as HistoryIcon,
  Loader2,
  LogOut,
  Play,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

import ConfigDialog from "@/components/ConfigDialog";
import ExecuteView from "@/components/ExecuteView";
import HistoryView from "@/components/HistoryView";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type View = "execute" | "history";

const NAV_ITEMS = [
  { id: "execute", label: "Execute", icon: Play },
  { id: "history", label: "History", icon: HistoryIcon },
] as const;

export default function Dashboard() {
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState<View>("execute");

  const [configOpen, setConfigOpen] = useState(false);

  // Bumped after a playbook is saved so ExecuteView reloads its list
  const [playbooksVersion, setPlaybooksVersion] = useState(0);

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const activeLabel = NAV_ITEMS.find((item) => item.id === activeView)?.label;

  const handleLogout = async () => {
    setLogoutError(null);
    setLoggingOut(true);

    try {
      const res = await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        setLogoutError("Logout failed. Please try again.");
        return;
      }

      // replace: true so the Back button doesn't return to the dashboard
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("Could not reach the server.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-4 py-3">
          <span className="text-lg font-semibold">ServAuto</span>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Playbooks</SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={activeView === item.id}
                      onClick={() => setActiveView(item.id)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />

          <Separator orientation="vertical" className="h-4" />

          <h1 className="text-sm font-medium">{activeLabel}</h1>

          <div className="ml-auto flex items-center gap-2">
            {logoutError && (
              <span className="text-xs text-destructive">{logoutError}</span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigOpen(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Config
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}

              {loggingOut ? "Logging out..." : "Log out"}
            </Button>
          </div>
        </header>

        <main className="p-6">
          {activeView === "execute" && (
            <ExecuteView key={playbooksVersion} />
          )}

          {activeView === "history" && <HistoryView />}
        </main>
      </SidebarInset>

      <ConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSaved={() => setPlaybooksVersion((version) => version + 1)}
      />
    </SidebarProvider>
  );
}