import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User } from "lucide-react";
import { cn } from "@/components/utils/utils";

import { getEventTypeInfo, getSeverityInfo } from "@/components/utils/auditUtils";

export default function AuditLogMobileCards({ logs, formatDate }) {
  return (
    <div className="md:hidden space-y-3">
      {logs.map((log) => {
        const eventInfo = getEventTypeInfo(log.event_type);
        const severityInfo = getSeverityInfo(log.severity);
        const EventIcon = eventInfo.icon;

        return (
          <Card key={log.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", eventInfo.color)} />
                  <EventIcon className="h-4 w-4" />
                  <span className="font-medium">{eventInfo.label}</span>
                </div>
                <Badge variant="outline" className="gap-1">
                  <div className={cn("w-2 h-2 rounded-full", severityInfo.color)} />
                  {severityInfo.label}
                </Badge>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(log.timestamp)}
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {log.user_id || "Sistema"}
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                {typeof log.details === "string"
                  ? log.details
                  : JSON.stringify(log.details)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
