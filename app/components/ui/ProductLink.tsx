import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * A product name, rendered as a link to that product's detail page. Product names show
 * up in a dozen places (lists, dashboard, PO lines, receipts, report tables) and every
 * one of them should be a way in to the product — this keeps that markup identical
 * everywhere instead of re-typing the same anchor classes per table.
 *
 * Deliberately NOT used inside the Sales Terminal cart / product grid or the Returns
 * terminal line picker: those names sit on tap-to-add and quantity controls mid-transaction,
 * where a navigation would interrupt the sale rather than help.
 */
export default function ProductLink({
  productId,
  children,
  className,
}: {
  productId: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/products/${productId}`}
      className={cn(
        "cursor-pointer font-medium text-text transition-colors duration-150 hover:text-primary hover:underline",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      {children}
    </Link>
  );
}
