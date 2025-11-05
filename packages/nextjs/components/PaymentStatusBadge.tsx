"use client";

import { PaymentMetadata } from "@/lib/types/delve-api";
import { truncateAddress } from "@/lib/utils";

interface PaymentStatusBadgeProps {
  payment?: PaymentMetadata;
  className?: string;
}

export function PaymentStatusBadge({ payment, className = "" }: PaymentStatusBadgeProps) {
  if (!payment) return null;

  const getBadgeClass = () => {
    if (payment.settled) return "badge-success";
    if (payment.verified) return "badge-info";
    return "badge-warning";
  };

  const getStatusText = () => {
    if (payment.settled) return "Payment Settled";
    if (payment.verified) return "Payment Verified";
    return "Payment Pending";
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className={`badge ${getBadgeClass()} gap-2`}>
        {payment.settled ? "✓" : payment.verified ? "⊙" : "○"}
        {getStatusText()}
      </div>

      {payment.microsub_active && (
        <div className="badge badge-accent gap-2">
          🔄 Microsub Active: {payment.queries_remaining || 0} queries left
        </div>
      )}

      {payment.from_address && <div className="text-xs opacity-70">From: {truncateAddress(payment.from_address)}</div>}

      {payment.tx_hash && <div className="text-xs opacity-70">TX: {truncateAddress(payment.tx_hash)}</div>}
    </div>
  );
}
