import { useLocation } from "wouter";
import { 
  BarChart3, 
  Building, 
  ChartPieIcon, 
  FileText, 
  LogOut, 
  Settings, 
  Users,
  X,
  CalendarIcon,
  Brain
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LAYOUT } from "@/lib/constants/ui-constants";
import DoliverLogo from "@/assets/doliver-logo-final.png";

import { useAuth } from "@/hooks/use-auth";

interface SidebarProps {
  onCloseMobile?: () => void;
}

export default function Sidebar({ onCloseMobile }: SidebarProps) {
  const [location] = useLocation();
  const { logout } = useAuth();

  // Navigation items
  const mainNavItems = [
    { 
      href: "/", 
      label: "Dashboard", 
      icon: <BarChart3 className="h-5 w-5 mr-2" /> 
    },
    { 
      href: "/pipeline", 
      label: "Pipeline", 
      icon: <Building className="h-5 w-5 mr-2" /> 
    },
    { 
      href: "/leaderboard", 
      label: "Leaderboard", 
      icon: <ChartPieIcon className="h-5 w-5 mr-2" /> 
    },
    { 
      href: "/funds", 
      label: "Funds", 
      icon: <FileText className="h-5 w-5 mr-2" /> 
    },
    { 
      href: "/calendar", 
      label: "Calendar", 
      icon: <CalendarIcon className="h-5 w-5 mr-2" /> 
    },
    { 
      href: "/ai-analysis", 
      label: "AI Analysis", 
      icon: <Brain className="h-5 w-5 mr-2" /> 
    },
  ];

  const adminNavItems = [
    { 
      href: "/settings", 
      label: "Settings", 
      icon: <Settings className="h-5 w-5 mr-2" /> 
    },
    { 
      href: "/users", 
      label: "Users", 
      icon: <Users className="h-5 w-5 mr-2" /> 
    },
  ];

  return (
    <aside className={`h-full bg-card shadow-md overflow-y-auto flex-shrink-0`} style={{ width: LAYOUT.SIDEBAR_WIDTH }}>
      {/* Set fixed width for consistent sidebar rendering */}
      <div className="flex flex-col h-full">
        {/* Mobile close button */}
        {onCloseMobile && (
          <div className="p-3 border-b border-border flex justify-end items-center md:hidden">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onCloseMobile}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}
        
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-2">
          {/* Logo */}
          <div className="mb-3 px-4 pt-3">
            <img 
              src={DoliverLogo} 
              alt="Doliver Logo" 
              className="h-8 w-auto" 
            />
          </div>
          
          <ul>
            {mainNavItems.map((item) => (
              <li key={item.href} className="mb-1 px-2">
                <a
                  href={item.href}
                  className={`sidebar-nav-link flex items-center py-2 px-3 hover:bg-muted transition-colors rounded-md text-sm ${
                    location === item.href
                      ? "active bg-muted text-primary-dark font-medium"
                      : "text-foreground"
                  }`}
                  onClick={() => onCloseMobile && window.innerWidth < 768 && onCloseMobile()}
                >
                  {item.icon}
                  {item.label}
                </a>
              </li>
            ))}
            
            <li className="mt-4 mb-2 px-2">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Admin
              </span>
            </li>
            
            {adminNavItems.map((item) => (
              <li key={item.href} className="mb-1 px-2">
                <a
                  href={item.href}
                  className={`sidebar-nav-link flex items-center py-2 px-3 hover:bg-muted transition-colors rounded-md text-sm ${
                    location === item.href
                      ? "active bg-muted text-primary-dark font-medium"
                      : "text-foreground"
                  }`}
                  onClick={() => onCloseMobile && window.innerWidth < 768 && onCloseMobile()}
                >
                  {item.icon}
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* Logout section */}
        <div className="p-3 border-t border-neutral-200">
          <a 
            href="#" 
            className="flex items-center py-2 px-3 rounded-md text-sm text-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={(e) => {
              e.preventDefault();
              logout.mutate();
              onCloseMobile && window.innerWidth < 768 && onCloseMobile();
            }}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Logout
          </a>
        </div>
      </div>
    </aside>
  );
}
