import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import IdentityManager from "@arcgis/core/identity/IdentityManager";
import OAuthInfo from "@arcgis/core/identity/OAuthInfo";
import esriConfig from "@arcgis/core/config";
import Portal from "@arcgis/core/portal/Portal";

interface ArcGISAuthContextType {
  isAuthenticated: boolean;
  user: any;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  portal: Portal | null;
  isLoading: boolean;
}

const ArcGISAuthContext = createContext<ArcGISAuthContextType | undefined>(undefined);

export function ArcGISAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [portal, setPortal] = useState<Portal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Configure ArcGIS API - Get from window.ENV or environment
    const clientId = (window as any).ENV?.VITE_ARCGIS_CLIENT_ID || 
                     import.meta.env.VITE_ARCGIS_CLIENT_ID || 
                     "fallback-client-id";
    
    const oAuthInfo = new OAuthInfo({
      appId: clientId,
      portalUrl: "https://www.arcgis.com/sharing/rest",
      popup: false, // Use redirect instead of popup
      flowType: "authorization-code"
    });

    IdentityManager.registerOAuthInfos([oAuthInfo]);

    // Check if user is already authenticated
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const credential = await IdentityManager.checkSignInStatus("https://www.arcgis.com/sharing/rest");
      
      if (credential) {
        const portalInstance = new Portal({
          url: "https://www.arcgis.com/sharing/rest"
        });
        
        await portalInstance.load();
        
        setIsAuthenticated(true);
        setUser(portalInstance.user);
        setPortal(portalInstance);
      }
    } catch (error) {
      console.log("User not authenticated:", error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async () => {
    try {
      setIsLoading(true);
      const credential = await IdentityManager.getCredential("https://www.arcgis.com/sharing/rest");
      
      const portalInstance = new Portal({
        url: "https://www.arcgis.com/sharing/rest"
      });
      
      await portalInstance.load();
      
      setIsAuthenticated(true);
      setUser(portalInstance.user);
      setPortal(portalInstance);
    } catch (error) {
      console.error("Sign in failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await IdentityManager.destroyCredentials();
      setIsAuthenticated(false);
      setUser(null);
      setPortal(null);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const value = {
    isAuthenticated,
    user,
    signIn,
    signOut,
    portal,
    isLoading
  };

  return (
    <ArcGISAuthContext.Provider value={value}>
      {children}
    </ArcGISAuthContext.Provider>
  );
}

export function useArcGISAuth() {
  const context = useContext(ArcGISAuthContext);
  if (context === undefined) {
    throw new Error("useArcGISAuth must be used within an ArcGISAuthProvider");
  }
  return context;
}