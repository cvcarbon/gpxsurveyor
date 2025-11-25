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
  isAdmin: boolean; // Has access to full lease layer
}

const ArcGISAuthContext = createContext<ArcGISAuthContextType | undefined>(undefined);

// Layer URLs
export const LEASE_LAYER_ADMIN = "https://services.arcgis.com/W1AXaDPef2QMa9kU/arcgis/rest/services/Leases/FeatureServer/0";
export const LEASE_LAYER_PUBLIC = "https://services.arcgis.com/W1AXaDPef2QMa9kU/arcgis/rest/services/Lease_Boundaries_Leasee_View/FeatureServer/0";
export const BEDDING_LAYER_URL = "https://services.arcgis.com/W1AXaDPef2QMa9kU/arcgis/rest/services/Bedding_Documentation_view/FeatureServer/0";

export function ArcGISAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [portal, setPortal] = useState<Portal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Configure ArcGIS API - Get from window.ENV or environment
    const clientId = (window as any).ENV?.VITE_ARCGIS_CLIENT_ID || 
                     import.meta.env.VITE_ARCGIS_CLIENT_ID || 
                     "fallback-client-id";
    
    console.log("ArcGIS Client ID:", clientId);
    
    const oAuthInfo = new OAuthInfo({
      appId: clientId,
      portalUrl: "https://www.arcgis.com",
      popup: false, // Use redirect instead of popup
      flowType: "authorization-code"
    });

    IdentityManager.registerOAuthInfos([oAuthInfo]);

    // Check if user is already authenticated
    checkAuthStatus();
  }, []);

  // Check if user has admin access to the full Leases layer
  const checkAdminAccess = async (token: string): Promise<boolean> => {
    try {
      // Try to query the admin layer - if it succeeds, user has access
      const response = await fetch(
        `${LEASE_LAYER_ADMIN}/query?where=1=1&returnCountOnly=true&f=json&token=${token}`
      );
      const data = await response.json();
      
      // If we get a count back (not an error), user has admin access
      if (data.count !== undefined && !data.error) {
        console.log(`Admin access confirmed - ${data.count} leases available`);
        return true;
      }
      
      console.log("Admin layer access denied:", data.error?.message || "Unknown error");
      return false;
    } catch (error) {
      console.log("Admin layer check failed:", error);
      return false;
    }
  };

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const credential = await IdentityManager.checkSignInStatus("https://www.arcgis.com");
      
      if (credential) {
        const portalInstance = new Portal({
          url: "https://www.arcgis.com"
        });
        
        await portalInstance.load();
        
        setIsAuthenticated(true);
        setUser(portalInstance.user);
        setPortal(portalInstance);
        
        // Check admin access with the token
        if (credential.token) {
          const hasAdminAccess = await checkAdminAccess(credential.token);
          setIsAdmin(hasAdminAccess);
        }
      }
    } catch (error) {
      console.log("User not authenticated:", error);
      setIsAuthenticated(false);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async () => {
    try {
      setIsLoading(true);
      console.log("Attempting to sign in to ArcGIS...");
      
      // Try to get credential - this will redirect to ArcGIS login if needed
      const credential = await IdentityManager.getCredential("https://www.arcgis.com", {
        error: null,
        oAuthPopupConfirmation: false,
        retry: false
      });
      
      console.log("Sign in successful, credential received:", credential);
      
      const portalInstance = new Portal({
        url: "https://www.arcgis.com"
      });
      
      await portalInstance.load();
      console.log("Portal loaded successfully:", portalInstance);
      
      setIsAuthenticated(true);
      setUser(portalInstance.user);
      setPortal(portalInstance);
      
      // Check admin access with the token
      if (credential.token) {
        const hasAdminAccess = await checkAdminAccess(credential.token);
        setIsAdmin(hasAdminAccess);
      }
    } catch (error: any) {
      console.error("Sign in failed:", error);
      setIsLoading(false);
      throw new Error(`Authentication failed: ${error.message || 'Unknown error'}`);
    }
  };

  const signOut = async () => {
    try {
      await IdentityManager.destroyCredentials();
      setIsAuthenticated(false);
      setUser(null);
      setPortal(null);
      setIsAdmin(false);
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
    isLoading,
    isAdmin
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
