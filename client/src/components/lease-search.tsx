import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, MapPin } from "lucide-react";
import { useArcGISAuth, LEASE_LAYER_ADMIN, LEASE_LAYER_PUBLIC } from "@/lib/arcgis-auth";
import IdentityManager from "@arcgis/core/identity/IdentityManager";

interface LeaseSearchProps {
  onLeaseFound: (geometry: any, attributes: any) => void;
}

export default function LeaseSearch({ onLeaseFound }: LeaseSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAdmin, isAuthenticated } = useArcGISAuth();

  if (!isAuthenticated) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const layerUrl = isAdmin ? LEASE_LAYER_ADMIN : LEASE_LAYER_PUBLIC;
      
      // Get token
      const credential = await IdentityManager.getCredential(layerUrl);
      const token = credential.token;

      // Try searching by Lease_Number (string match)
      // Note: Adjust 'Lease_Number' if the actual field name is different (e.g. 'Lease_ID', 'Lease')
      const whereClause = `Lease_Number = '${searchTerm}'`;
      
      const queryUrl = `${layerUrl}/query?where=${encodeURIComponent(whereClause)}&outFields=*&returnGeometry=true&f=geojson&token=${token}`;
      
      console.log(`Searching for lease: ${queryUrl}`);
      
      const response = await fetch(queryUrl);
      const data = await response.json();

      if (data.error) {
        console.error("Search error:", data.error);
        
        // If it was a 400 error, it might be because the field is numeric and we used quotes
        // Or the field name is wrong.
        // Let's try numeric search if the input looks numeric
        if (!isNaN(Number(searchTerm))) {
             console.log("Retrying with numeric query...");
             const whereClauseNum = `Lease_Number = ${searchTerm}`;
             const queryUrlNum = `${layerUrl}/query?where=${encodeURIComponent(whereClauseNum)}&outFields=*&returnGeometry=true&f=geojson&token=${token}`;
             const responseNum = await fetch(queryUrlNum);
             const dataNum = await responseNum.json();
             
             if (dataNum.features && dataNum.features.length > 0) {
                const feature = dataNum.features[0];
                onLeaseFound(feature.geometry, feature.properties);
                return;
             }
        }
        
        throw new Error(data.error.message || "Search failed");
      }

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        onLeaseFound(feature.geometry, feature.properties);
      } else {
        setError("No lease found with that number");
      }
    } catch (err: any) {
      console.error("Lease search error:", err);
      setError(err.message || "Failed to search for lease");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Card className="border-0 border-b border-gray-100 rounded-none bg-blue-50/50">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search Lease
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input 
            placeholder="Lease Number..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 bg-white"
          />
          <Button type="submit" size="sm" disabled={isSearching || !searchTerm}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          </Button>
        </form>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}
