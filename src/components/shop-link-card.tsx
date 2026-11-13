import { shopLink, shopQrSvg } from "@/lib/distributors-public";
import { CopyButton } from "@/app/account/copy-button";

/** A distributor's public shop link with a printable QR code. */
export async function ShopLinkCard({ slug, live }: { slug: string; live: boolean }) {
  const url = shopLink(slug);
  const svg = await shopQrSvg(slug);
  return (
    <section className="card p-5">
      <h2 className="font-semibold text-lg">Shop page &amp; QR code</h2>
      {!live && <p className="mt-1 text-sm text-danger">The page goes live once the distributor is active and has at least one area.</p>}
      <div className="mt-3 flex flex-wrap items-center gap-5">
        <div className="h-36 w-36 shrink-0 rounded-xl border border-border bg-white p-2" role="img" aria-label={`QR code for ${url}`}
          dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="min-w-0 space-y-2 text-sm">
          <p className="break-all font-mono">{url}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={url} label="Copy link" />
            <a href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} download={`${slug}-qr.svg`}
              className="shrink-0 rounded-full border border-brand px-4 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft">Download QR</a>
          </div>
          <p className="text-xs text-muted">Print it for the shop counter or delivery van. Scanning opens the shop page, where customers pick their area.</p>
        </div>
      </div>
    </section>
  );
}
