import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useArcGISAuth } from "@/lib/arcgis-auth";
import { LogIn, LogOut, User, Loader2 } from "lucide-react";

export default function ArcGISSignIn() {
  const { isAuthenticated, user, signIn, signOut, isLoading } = useArcGISAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      console.log("Starting sign in process...");
      await signIn();
      console.log("Sign in completed successfully");
    } catch (error) {
      console.error("Sign in error:", error);
      // Don't show alert to avoid breaking UI
      console.log("Sign in failed, will show in UI");
    } finally {
      setIsSigningIn(false);
      console.log("Sign in process finished");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (isLoading) {
    return (
      <Button size="sm" variant="ghost" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (isAuthenticated && user) {
    return (
      <Button 
        onClick={handleSignOut} 
        variant="outline" 
        size="sm"
        title={`Signed in as: ${user.fullName || user.username}`}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleSignIn} 
      disabled={isSigningIn}
      size="sm"
      variant="outline"
      title="Sign in to ArcGIS"
    >
      {isSigningIn ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogIn className="h-4 w-4" />
      )}
    </Button>
  );
}