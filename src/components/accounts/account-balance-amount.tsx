"use client";

import { AnimatedMoney } from "@/components/ui/animated-money";

export function AccountBalanceAmount({ amount }: { amount: string }) {
  return (
    <AnimatedMoney
      value={amount}
      className="inline-block text-lg font-semibold"
    />
  );
}
