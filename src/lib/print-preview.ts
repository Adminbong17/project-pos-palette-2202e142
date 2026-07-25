// Shared print preview: shows a modal preview with Print + Save-as-JPG buttons.
// Callers prepare a printable node (`printPage`) already mounted in the DOM
// with the correct @media print CSS, then call showPrintPreview instead of
// window.print() directly.

export function showPrintPreview(opts: {
  printPage: HTMLElement;
  cleanup: () => void;
  filename?: string;
}) {
  const { printPage, cleanup, filename = "document" } = opts;

  const overlay = document.createElement("div");
  overlay.id = "print-preview-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.75);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;gap:12px;font-family:ui-sans-serif,system-ui,Arial,sans-serif;";

  const frame = document.createElement("div");
  frame.style.cssText =
    "background:#fff;color:#000;max-height:75vh;max-width:95vw;overflow:auto;border-radius:8px;padding:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);";

  const clone = printPage.cloneNode(true) as HTMLElement;
  clone.id = "";
  clone.className = (clone.className ? clone.className + " " : "") + "receipt-preview-clone";
  clone.style.cssText = "position:static;margin:0 auto;display:block;visibility:visible;background:#fff;color:#000;";
  frame.appendChild(clone);

  const btns = document.createElement("div");
  btns.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;justify-content:center;";

  const mkBtn = (label: string, bg: string, color: string) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = `padding:10px 20px;border-radius:8px;border:0;font-weight:600;cursor:pointer;font-size:14px;background:${bg};color:${color};`;
    return b;
  };
  const saveBtn = mkBtn("💾 Save JPG", "#10b981", "#ffffff");
  const printBtn = mkBtn("🖨️ Print", "#3b82f6", "#ffffff");
  const cancelBtn = mkBtn("Cancel", "#e5e7eb", "#000000");
  btns.append(saveBtn, printBtn, cancelBtn);

  overlay.append(frame, btns);

  // Hide overlay itself when the browser print dialog captures the page
  const hideStyle = document.createElement("style");
  hideStyle.textContent = `@media print { #print-preview-overlay { display: none !important; } }`;
  document.head.appendChild(hideStyle);
  document.body.appendChild(overlay);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.remove();
    hideStyle.remove();
    cleanup();
  };

  cancelBtn.onclick = close;

  printBtn.onclick = () => {
    // Print via an isolated iframe. This avoids the fragile @media print
    // + `body > *:not(#printId){display:none}` approach used by callers,
    // which caused blank prints in some browsers even though Save-as-JPG
    // (which renders the clone directly) worked fine.
    printBtn.setAttribute("disabled", "true");
    printBtn.textContent = "Preparing…";

    // Fresh clone that keeps the original id, so caller CSS scoped to
    // #printId inside <style> tags in <head> still applies inside the iframe.
    const printClone = printPage.cloneNode(true) as HTMLElement;
    printClone.style.cssText =
      "position:static;left:auto;top:auto;opacity:1;pointer-events:auto;z-index:auto;width:auto;max-width:none;background:#fff;color:#000;";

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      alert("Unable to open print window.");
      close();
      return;
    }

    // Copy <link rel="stylesheet"> tags and every <style> block from the
    // host document. Strip the caller's `body > *:not(#printId){display:none}`
    // rules — inside the iframe everything IS the printable content, and
    // those rules would blank the page.
    const linkHtml = Array.from(
      document.head.querySelectorAll("link[rel='stylesheet']"),
    )
      .map((l) => l.outerHTML)
      .join("");
    const styleHtml = Array.from(document.head.querySelectorAll("style"))
      .map((s) => {
        let css = s.textContent ?? "";
        // Remove any `body > * ... { ... }` rule (with or without :not()).
        css = css.replace(/body\s*>\s*\*[^{]*\{[^}]*\}/g, "");
        return `<style>${css}</style>`;
      })
      .join("");

    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${filename}</title>${linkHtml}${styleHtml}
      <style>
        html,body{margin:0;padding:0;background:#fff !important;color:#000 !important;}
        html body > *{display:block !important;visibility:visible !important;position:static !important;}
      </style>
      </head><body></body></html>`,
    );
    doc.close();
    doc.body.appendChild(printClone);

    const doPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Print failed", err);
      }
      // Give the browser time to open the print dialog before removing.
      setTimeout(() => {
        iframe.remove();
        close();
      }, 1000);
    };

    // Wait for images (barcodes, data URLs) inside the clone to be ready.
    const imgs = Array.from(doc.images);
    const pending = imgs.filter((i) => !i.complete);
    if (pending.length === 0) {
      setTimeout(doPrint, 100);
    } else {
      let remaining = pending.length;
      const onDone = () => {
        remaining -= 1;
        if (remaining <= 0) setTimeout(doPrint, 100);
      };
      pending.forEach((img) => {
        img.addEventListener("load", onDone, { once: true });
        img.addEventListener("error", onDone, { once: true });
      });
      // Safety timeout in case images stall.
      setTimeout(doPrint, 1500);
    }
  };

  saveBtn.onclick = async () => {
    saveBtn.textContent = "Saving…";
    saveBtn.setAttribute("disabled", "true");
    try {
      const { toJpeg } = await import("html-to-image");
      const url = await toJpeg(clone, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        quality: 0.95,
        skipFonts: true,
        filter: (node) => {
          // Skip <style>/<link> tags from being inlined (they may contain oklch)
          const tag = (node as HTMLElement).tagName;
          return tag !== "STYLE" && tag !== "LINK";
        },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error(e);
      alert("Failed to save image: " + ((e as Error)?.message ?? "unknown"));
    }
    close();
  };
}
