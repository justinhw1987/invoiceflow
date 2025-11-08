import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <FileQuestion className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-muted-foreground mb-6">Page not found</p>
        <Button onClick={() => setLocation("/")} data-testid="button-go-home">
          Go Home
        </Button>
      </div>
    </div>
  );
}
