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
  const saveBtn = mkBtn("💾 সেভ করুন", "#10b981", "#ffffff");
  const printBtn = mkBtn("🖨️ প্রিন্ট", "#3b82f6", "#ffffff");
  const cancelBtn = mkBtn("বাতিল", "#e5e7eb", "#000000");
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
    printBtn.setAttribute("disabled", "true");
    printBtn.textContent = "Preparing…";

    // Fresh clone that keeps the original id, so caller CSS scoped to
    // #printId inside <style> tags in <head> still applies inside the iframe.
    const printClone = printPage.cloneNode(true) as HTMLElement;
    const widthStyle = printPage.style.width
      ? `width:${printPage.style.width} !important;max-width:${printPage.style.maxWidth || printPage.style.width} !important;`
      : "";
    printClone.style.cssText =
      `position:static;left:auto;top:auto;opacity:1;pointer-events:auto;z-index:auto;margin:0 auto !important;background:#fff;color:#000;${widthStyle}`;

    // Copy <link rel="stylesheet"> tags and every <style> block from the
    // host document, stripping the caller's `body > *:not(#printId)` rules
    // which would blank the iframe page.
    const linkHtml = Array.from(
      document.head.querySelectorAll("link[rel='stylesheet']"),
    )
      .map((l) => l.outerHTML)
      .join("");
    const styleHtml = Array.from(document.head.querySelectorAll("style"))
      .map((s) => {
        let css = s.textContent ?? "";
        css = css.replace(/body\s*>\s*\*[^{]*\{[^}]*\}/g, "");
        return `<style>${css}</style>`;
      })
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title></title>${linkHtml}${styleHtml}
      <style>
        html,body{margin:0;padding:0;background:#fff !important;color:#000 !important;}
        html body > *{display:block !important;visibility:visible !important;position:static !important;margin:0 auto !important;}
      </style>
      </head><body>${printClone.outerHTML}</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    // Keep it in the layout flow but invisible: zero-size iframes are skipped
    // by some browsers' print pipeline.
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0.01;border:0;";

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setTimeout(() => {
        iframe.remove();
        close();
      }, 1500);
    };

    const fallbackPrint = () => {
      // Last resort: print the host document, which already carries the
      // caller's @media print rules for #printId.
      iframe.remove();
      overlay.style.display = "none";
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.error("Host print failed", err);
      }
      setTimeout(() => {
        overlay.style.display = "";
        close();
      }, 1000);
    };

    const doPrint = () => {
      if (done) return;
      const win = iframe.contentWindow;
      if (!win) {
        done = true;
        fallbackPrint();
        return;
      }
      try {
        win.focus();
        if (typeof win.print !== "function") throw new Error("print unavailable");
        win.print();
        finish();
      } catch (err) {
        console.error("Iframe print failed", err);
        done = true;
        fallbackPrint();
      }
    };

    iframe.onload = () => {
      const doc = iframe.contentDocument;
      const imgs = doc ? Array.from(doc.images) : [];
      const pending = imgs.filter((i) => !i.complete);
      if (pending.length === 0) {
        setTimeout(doPrint, 150);
      } else {
        let remaining = pending.length;
        const onDone = () => {
          remaining -= 1;
          if (remaining <= 0) setTimeout(doPrint, 150);
        };
        pending.forEach((img) => {
          img.addEventListener("load", onDone, { once: true });
          img.addEventListener("error", onDone, { once: true });
        });
        setTimeout(doPrint, 2000);
      }
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);

    // Safety: if onload never fires, still attempt a print.
    setTimeout(doPrint, 3000);
  };


  saveBtn.onclick = async () => {
    saveBtn.textContent = "সেভ হচ্ছে…";
    saveBtn.setAttribute("disabled", "true");
    try {
      // 1. Primary: html2canvas
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(clone, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95);
      });

      if (!blob) throw new Error("Canvas blob conversion failed");

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${filename}.jpg`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        try {
          a.remove();
          URL.revokeObjectURL(blobUrl);
        } catch (_) {}
      }, 3000);

      close();
      return;
    } catch (h2cErr) {
      console.warn("html2canvas save failed, trying html-to-image fallback:", h2cErr);
    }

    try {
      const { toJpeg } = await import("html-to-image");
      const url = await toJpeg(clone, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        quality: 0.95,
        skipFonts: true,
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      close();
    } catch (err2) {
      console.error("Image save error:", err2);
      alert("ছবি সেভ করতে সমস্যা হয়েছে। অনুগ্রহ করে প্রিন্ট অপশনটি ব্যবহার করুন।");
      saveBtn.textContent = "💾 সেভ করুন";
      saveBtn.removeAttribute("disabled");
    }
  };
}
