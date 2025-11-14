import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import Invoices from "@/pages/invoices";
import CreateInvoice from "@/pages/create-invoice";
import RecurringInvoices from "@/pages/recurring-invoices";
import CreateRecurringInvoice from "@/pages/create-recurring-invoice";
import NotFound from "@/pages/not-found";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <AuthGuard>
          <Layout>
            <Dashboard />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/customers">
        <AuthGuard>
          <Layout>
            <Customers />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/invoices">
        <AuthGuard>
          <Layout>
            <Invoices />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/invoices/new">
        <AuthGuard>
          <Layout>
            <CreateInvoice />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/invoices/:id/edit">
        {(params) => (
          <AuthGuard>
            <Layout>
              <CreateInvoice id={params.id} />
            </Layout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/recurring-invoices">
        <AuthGuard>
          <Layout>
            <RecurringInvoices />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/recurring-invoices/new">
        <AuthGuard>
          <Layout>
            <CreateRecurringInvoice />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/recurring-invoices/:id/edit">
        {(params) => (
          <AuthGuard>
            <Layout>
              <CreateRecurringInvoice id={params.id} />
            </Layout>
          </AuthGuard>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
