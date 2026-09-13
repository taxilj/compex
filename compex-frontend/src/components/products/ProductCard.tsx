import Link from "next/link";
import { Package } from "lucide-react";
import type { BackendProduct } from "@/lib/api/products";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";

interface ProductCardProps {
  product: BackendProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const detailHref = `/products/${encodeURIComponent(product.mpn)}${product.manufacturer?.id ? `?manufacturerId=${encodeURIComponent(product.manufacturer.id)}` : ""}`;
  const quoteHref = `/request-quote?mpn=${encodeURIComponent(product.mpn)}&manufacturer=${encodeURIComponent(product.manufacturer?.name ?? "")}`;
  const image = product.images[0];

  return (
    <div className="group bg-white border border-[#E4E7EC] rounded flex flex-col hover:border-[#1769E0] transition-colors">
      <Link href={detailHref} className="flex flex-col flex-1 min-w-0">
        <div className="aspect-square w-full bg-[#f0f3ff] border-b border-[#E4E7EC] flex items-center justify-center overflow-hidden">
          <ImageWithFallback
            src={image}
            alt={product.name ?? product.mpn}
            className="w-full h-full object-contain p-4"
            fallback={<Package size={32} className="text-[#0B1F3A]/20" />}
          />
        </div>
        <div className="flex-1 flex flex-col gap-1.5 p-4">
          {product.category && (
            <span className="font-label-sm text-[#1769E0] uppercase tracking-wider text-[10px] truncate">{product.category.name}</span>
          )}
          <p className="font-mono text-[17px] font-bold text-[#0B1F3A] leading-tight break-words">{product.mpn}</p>
          <p className="font-label-md text-[#273143] break-words">{product.manufacturer?.name ?? "—"}</p>
          <p className="font-body-sm text-[#44474d]/80 line-clamp-2">{product.description ?? "No description available."}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {product.packageType && <span className="tag">{product.packageType}</span>}
            {product.lifecycleStatus && <span className="font-body-sm text-[#44474d] text-xs">{product.lifecycleStatus}</span>}
          </div>
          <p className="font-body-sm text-[#44474d] text-xs mt-0.5">
            {product.datasheetUrl ? "Datasheet available" : "Datasheet unavailable"}
          </p>
        </div>
      </Link>
      <div className="px-4 pb-4 pt-2 flex items-center justify-between gap-2">
        <Link href={detailHref} className="font-label-md text-[#1769E0] text-sm hover:underline">
          View Product
        </Link>
        <Link
          href={quoteHref}
          className="bg-[#1769E0] text-white px-3 py-1.5 rounded font-label-sm text-xs hover:bg-[#1257b8] transition-colors whitespace-nowrap"
        >
          Request Quote
        </Link>
      </div>
    </div>
  );
}
