import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function UserSearchBar({ search, setSearch }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
          <Input
            placeholder="Buscar por email..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
