"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { es } from "@/locales/es";
import { getOrderStatusVariant } from "@/lib/permissions";
import type { Order, OrderStatus } from "@/types/database";
import { formatDate, profileDisplayName } from "@/lib/utils";

type OrderWithProfiles = Order & {
  created_by?: { name: string } | null;
  prepared_by?: { name: string } | null;
  completed_by?: { name: string } | null;
};

export function OrderDetailHeader({
  order,
  progressLabel,
}: {
  order: OrderWithProfiles;
  progressLabel: string;
}) {
  const createdByName = profileDisplayName(order.created_by);
  const preparedByName = profileDisplayName(order.prepared_by);
  const completedByName = profileDisplayName(order.completed_by);

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{order.order_number}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={getOrderStatusVariant(order.status)}>
              {es.orders.statuses[order.status as OrderStatus]}
            </Badge>
            {order.has_issues ? (
              <Badge variant="destructive">{es.orders.completeWithIssues}</Badge>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-muted">
            {es.orders.progress}: {progressLabel}
          </p>
        </div>
      </div>

      {createdByName && (
        <p className="text-sm text-muted">
          {es.orders.requester}: {createdByName}
        </p>
      )}

      <Card className="border-border bg-surface-1">
        <CardHeader>
          <CardTitle>{es.orders.destination}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{order.requester_name}</p>
          {order.requester_phone && <p>{order.requester_phone}</p>}
          {order.requester_city && (
            <p>
              {order.requester_city}
              {order.requester_state ? `, ${order.requester_state}` : ""}
            </p>
          )}
          {order.requester_notes && (
            <p className="text-muted">
              {es.orders.notes}: {order.requester_notes}
            </p>
          )}
          <p className="text-muted">{formatDate(order.created_at)}</p>
          <p className="text-muted">
            {es.orders.updatedAt}: {formatDate(order.updated_at)}
          </p>
          {preparedByName && (
            <p className="text-muted">
              {es.orders.preparingBy}: {preparedByName}
            </p>
          )}
          {completedByName && (
            <p className="text-muted">
              {es.orders.handledBy}: {completedByName}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
