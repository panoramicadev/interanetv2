import { ReactNode } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface CmmsLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
  backPath?: string;
}

export function CmmsLayout({ 
  children, 
  showBackButton = true, 
  backPath = "/mantenciones" 
}: CmmsLayoutProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background" data-testid="layout-cmms">
      {/* Back button - only show if not on dashboard */}
      {showBackButton && (
        <div className="border-b bg-background">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation(backPath)}
              data-testid="button-back-to-main"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
