export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="print:hidden border-t border-border/50 bg-background/70 px-4 py-3 text-center text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground/70">© {year} QweekRx</span>
      <span className="mx-1.5 opacity-50">•</span>
      <span>All rights reserved</span>
      <span className="mx-1.5 opacity-50">•</span>
      <a href="tel:01712472839" className="hover:text-primary">
        01712472839 (Phone/WhatsApp)
      </a>
    </footer>
  );
}
