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
      await signIn();
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsSigningIn(false);
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking ArcGIS Authentication...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (isAuthenticated && user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-green-600" />
            ArcGIS Authenticated
          </CardTitle>
          <CardDescription>
            Signed in as: {user.fullName || user.username}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleSignOut} 
            variant="outline" 
            size="sm"
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="h-4 w-4" />
          ArcGIS Authentication Required
        </CardTitle>
        <CardDescription>
          Sign in to access your lease boundaries layer
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleSignIn} 
          disabled={isSigningIn}
          className="w-full"
        >
          {isSigningIn ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Signing In...
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4 mr-2" />
              Sign In to ArcGIS
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}