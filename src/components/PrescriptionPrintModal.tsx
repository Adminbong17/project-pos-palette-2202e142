import { useState, useEffect, useRef } from "react";
import {
  thermalPrinter,
  type ConnectedPrinterInfo,
} from "@/lib/bluetooth-printer";
import { BluetoothPrinterModal } from "@/components/BluetoothPrinterModal";
import { Button } from "@/components/ui/button";
import { Bluetooth, Printer, X, RefreshCw, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import type { PrintSize } from "@/components/print-size-select";

export interface PrescriptionPrintModalProps {
  open: boolean;
  onClose: () => void;
  rx: any | null;
  buildRxHtml: (rx: any, size: PrintSize) => Promise<{ styles: string; body: string; title: string }>;
  printRx: (rx: any, size: PrintSize) => Promise<void>;
  savePdf: (rx: any, size?: PrintSize) => Promise<void>;
  saveJpg?: (rx: any, size?: PrintSize) => Promise<void>;
  initialSize?: PrintSize;
  businessName?: string;
}

export function PrescriptionPrintModal({
  open,
  onClose,
  rx,
  buildRxHtml,
  printRx,
  savePdf,
  saveJpg,
  initialSize = "58mm",
  businessName = "Sheikh Pharma",
}: PrescriptionPrintModalProps) {
  if (!open || !rx) return null;

  const [size, setSize] = useState<PrintSize>(initialSize);
  const [htmlContent, setHtmlContent] = useState<{ styles: string; body: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [btPrinting, setBtPrinting] = useState(false);
  const [btModalOpen, setBtModalOpen] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState<ConnectedPrinterInfo | null>(
    thermalPrinter.getConnectedPrinter()
  );

  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return thermalPrinter.subscribe(setConnectedPrinter);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    buildRxHtml(rx, size)
      .then((res) => {
        if (active) {
          setHtmlContent(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [rx, size, buildRxHtml]);

  const handleRegularPrint = () => {
    printRx(rx, size);
  };

  const handleBluetoothPrint = async () => {
    if (!thermalPrinter.isConnected()) {
      setBtModalOpen(true);
      return;
    }

    if (!previewContainerRef.current) {
      toast.error("রসিদ লোড হয়নি");
      return;
    }

    setBtPrinting(true);
    try {
      const targetDots = size === "80mm" ? 576 : 384;
      const { toCanvas } = await import("html-to-image");
      const canvas = await toCanvas(previewContainerRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 1,
        skipFonts: true,
      });

      await thermalPrinter.printCanvasDirect(canvas, targetDots);
      toast.success(
        `প্রেসক্রিপশন স্লিপ ব্লুটুথ প্রিন্টারে (${connectedPrinter?.name}) প্রিন্ট সম্পন্ন হয়েছে!`
      );
      onClose();
    } catch (err: any) {
      toast.error(err.message || "ব্লুটুথ প্রিন্ট ব্যর্থ হয়েছে");
    } finally {
      setBtPrinting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
        <div className="bg-card rounded-2xl border border-border w-full max-w-md overflow-hidden print:hidden shadow-2xl flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                <span>প্রেসক্রিপশন প্রিন্ট (Rx Slip)</span>
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono">
                Rx No: {rx.rx_no || "—"} | রোগী: {rx.patient_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded-lg hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto">
            {/* Paper Width Selection */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSize("58mm")}
                className={`flex-1 h-9 rounded-lg border text-sm font-medium cursor-pointer transition ${
                  size === "58mm"
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                58 mm (স্লিপ)
              </button>
              <button
                type="button"
                onClick={() => setSize("80mm")}
                className={`flex-1 h-9 rounded-lg border text-sm font-medium cursor-pointer transition ${
                  size === "80mm"
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                80 mm (স্লিপ)
              </button>
              <button
                type="button"
                onClick={() => setSize("A4")}
                className={`flex-1 h-9 rounded-lg border text-sm font-medium cursor-pointer transition ${
                  size === "A4"
                    ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                A4 (প্যাড)
              </button>
            </div>

            {/* Preview Box */}
            <div className="rounded-lg border border-border bg-white text-black p-3 max-h-72 overflow-y-auto overflow-x-hidden shadow-inner flex justify-center">
              {loading || !htmlContent ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  <span>প্রেসক্রিপশন তৈরি হচ্ছে…</span>
                </div>
              ) : (
                <div
                  ref={previewContainerRef}
                  style={{
                    width: size === "A4" ? "100%" : size === "58mm" ? "260px" : "320px",
                    maxWidth: "100%",
                    background: "#ffffff",
                    color: "#000000",
                    padding: size === "58mm" ? "4px" : "8px",
                  }}
                >
                  <style>{htmlContent.styles}</style>
                  <div dangerouslySetInnerHTML={{ __html: htmlContent.body }} />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              {(size === "58mm" || size === "80mm") && (
                <Button
                  type="button"
                  onClick={handleBluetoothPrint}
                  disabled={btPrinting || loading}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-2 shadow-md cursor-pointer"
                >
                  {btPrinting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bluetooth className="h-4 w-4" />
                  )}
                  <span>
                    {connectedPrinter
                      ? `⚡ Bluetooth Print (${connectedPrinter.name})`
                      : "⚡ Bluetooth প্রিন্টারে পাঠান (PT-220)"}
                  </span>
                </Button>
              )}

              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={handleRegularPrint}
                  variant="outline"
                  disabled={loading}
                  className="h-9 rounded-xl text-xs cursor-pointer gap-1.5 px-2"
                  title="প্রিন্টার দিয়ে প্রিন্ট করুন"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
                <Button
                  onClick={() => savePdf(rx, size)}
                  variant="outline"
                  disabled={loading}
                  className="h-9 rounded-xl text-xs cursor-pointer gap-1.5 px-2"
                  title="PDF ফাইল ডাউনলোড করুন"
                >
                  <FileText className="h-3.5 w-3.5" /> PDF
                </Button>
                {saveJpg && (
                  <Button
                    onClick={() => saveJpg(rx, size)}
                    variant="outline"
                    disabled={loading}
                    className="h-9 rounded-xl text-xs cursor-pointer gap-1.5 px-2 text-emerald-600 hover:text-emerald-700"
                    title="JPG ছবি হিসেবে ডাউনলোড করুন"
                  >
                    <ImageIcon className="h-3.5 w-3.5" /> JPG
                  </Button>
                )}
              </div>

              <Button
                variant="ghost"
                onClick={onClose}
                className="w-full h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                বন্ধ করুন / Close
              </Button>
            </div>
          </div>
        </div>
      </div>

      <BluetoothPrinterModal
        open={btModalOpen}
        onOpenChange={setBtModalOpen}
        businessName={businessName}
      />
    </>
  );
}
