import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArcGISAuthProvider } from "@/lib/arcgis-auth";
import NotFound from "@/pages/not-found";
import RoutePlanner from "@/pages/route-planner";

function Router() {
  return (
    <Switch>
      <Route path="/" component={RoutePlanner} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ArcGISAuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ArcGISAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
