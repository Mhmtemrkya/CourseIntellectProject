import type * as React from "react"

import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("ci-skeleton rounded-xl bg-muted/70", className)}
      {...props} />
  );
}

export { Skeleton }
