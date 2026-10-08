import { useState } from "react";
import { Play, Settings } from "lucide-react";

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

import ConfigView from "@/components/ConfigView";
import ExecuteView from "@/components/ExecuteView";
import HistoryView from "@/components/HistoryView";

type View = "config" | "execute" | "history";

const NAV_ITEMS = [
  { id: "config", label: "Config", icon: Settings },
  { id: "execute", label: "Execute", icon: Play },
  { id: "history", label: "History", icon: Play },
] as const;

export default function Dashboard() {
  const [activeView, setActiveView] = useState<View>("config");

  const activeLabel = NAV_ITEMS.find((item) => item.id === activeView)?.label;

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
        </header>

        <main className="p-6">
          {activeView === "config" && <ConfigView />}
          {activeView === "execute" && <ExecuteView />}
          {activeView === "history" && <HistoryView />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}