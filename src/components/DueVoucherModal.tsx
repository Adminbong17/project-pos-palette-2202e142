import { useState, useEffect } from "react";
import {
  thermalPrinter,
  type ConnectedPrinterInfo,
  type ReceiptFontSize,
} from "@/lib/bluetooth-printer";
import {
  printDueVoucher,
  getDueVoucherHtml,
  dueVoucherCss,
  type DueVoucherData,
} from "@/lib/due-print";
import { BluetoothPrinterModal } from "@/components/BluetoothPrinterModal";
import { Button } from "@/components/ui/button";
import { Bluetooth, Printer, X, RefreshCw, Type, HandCoins } from "lucide-react";
import { toast } from "sonner";

export interface DueVoucherModalProps {
  open: boolean;
  onClose: () => void;
  voucher: DueVoucherData | null;
  initialWidth?: "58" | "80" | "A4";
}

export function DueVoucherModal({
  open,
  onClose,
  voucher,
  initialWidth,
}: DueVoucherModalProps) {
  if (!open || !voucher) return null;

  const [width, setWidth] = useState<"58" | "80" | "A4">(() => {
    if (initialWidth) return initialWidth;
    return (localStorage.getItem("due_print_width") as "58" | "80" | "A4") || "58";
  });

  const [btPrinting, setBtPrinting] = useState(false);
  const [btModalOpen, setBtModalOpen] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState<ConnectedPrinterInfo | null>(
    thermalPrinter.getConnectedPrinter()
  );

  const [btFontSize, setBtFontSize] = useState<ReceiptFontSize>(() => {
    return (localStorage.getItem("pos_bt_font_size") as ReceiptFontSize) || "large";
  });

  const [btPrintMode, setBtPrintMode] = useState<"canvas" | "text">(() => {
    return (localStorage.getItem("pos_bt_print_mode") as "canvas" | "text") || "canvas";
  });

  useEffect(() => {
    return thermalPrinter.subscribe(setConnectedPrinter);
  }, []);

  const handleWidthChange = (w: "58" | "80" | "A4") => {
    setWidth(w);
    localStorage.setItem("due_print_width", w);
  };

  const handleFontSizeChange = (size: ReceiptFontSize) => {
    setBtFontSize(size);
    localStorage.setItem("pos_bt_font_size", size);
  };

  const handlePrintModeChange = (mode: "canvas" | "text") => {
    setBtPrintMode(mode);
    localStorage.setItem("pos_bt_print_mode", mode);
  };

  const handleRegularPrint = () => {
    printDueVoucher(voucher, width);
  };

  const handleBluetoothPrint = async () => {
    if (!thermalPrinter.isConnected()) {
      setBtModalOpen(true);
      return;
    }
    setBtPrinting(true);
    try {
      const targetDots = width === "80" ? 576 : 384;
      if (btPrintMode === "text") {
        await thermalPrinter.printDueVoucherEscPosText(
          voucher,
          width === "80" ? 48 : 32
        );
      } else {
        await thermalPrinter.printDueVoucherDirect(
          voucher,
          targetDots,
          btFontSize
        );
      }
      toast.success(
        `বকেয়া রশিদ ব্লুটুথ প্রিন্টারে (${connectedPrinter?.name}) প্রিন্ট হয়েছে!`
      );
      onClose();
    } catch (err: any) {
      toast.error(err.message || "ব্লুটুথ প্রিন্ট ব্যর্থ হয়েছে");
    } finally {
      setBtPrinting(false);
    }
  };

  const previewFontSize =
    width === "A4"
      ? "13px"
      : btFontSize === "xlarge"
        ? "14px"
        : btFontSize === "large"
          ? "12.5px"
          : "11px";

  const previewMm = width === "58" ? "260px" : width === "80" ? "300px" : "100%";
  const html = getDueVoucherHtml(voucher, width);
  const css = dueVoucherCss(".due-voucher-preview-clone", previewFontSize, previewMm);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
        <div className="bg-card rounded-2xl border border-border w-full max-w-md sm:max-w-lg overflow-hidden print:hidden shadow-2xl flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <HandCoins className="h-4 w-4 text-rose-600" />
                <span>বকেয়া আদায় রশিদ / Due Voucher</span>
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono">
                রশিদ নং: {voucher.voucherNo} | চালান: {voucher.invoiceNo}
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
                onClick={() => handleWidthChange("58")}
                className={`flex-1 h-9 rounded-lg border text-sm font-medium cursor-pointer transition ${
                  width === "58"
                    ? "border-rose-600 bg-rose-500/10 text-rose-600 font-bold shadow-xs"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                58 mm
              </button>
              <button
                type="button"
                onClick={() => handleWidthChange("80")}
                className={`flex-1 h-9 rounded-lg border text-sm font-medium cursor-pointer transition ${
                  width === "80"
                    ? "border-rose-600 bg-rose-500/10 text-rose-600 font-bold shadow-xs"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                80 mm
              </button>
              <button
                type="button"
                onClick={() => handleWidthChange("A4")}
                className={`flex-1 h-9 rounded-lg border text-sm font-medium cursor-pointer transition ${
                  width === "A4"
                    ? "border-rose-600 bg-rose-500/10 text-rose-600 font-bold shadow-xs"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                A4
              </button>
            </div>

            {/* Font Size & Print Mode bar for Bluetooth */}
            <div className="bg-muted/40 rounded-xl p-2.5 border border-border/70 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-semibold flex items-center gap-1">
                  <Type className="h-3.5 w-3.5 text-primary" /> ফন্ট সাইজ:
                </span>
                <div className="inline-flex rounded-lg border border-border/80 bg-background p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleFontSizeChange("normal")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                      btFontSize === "normal"
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    স্বাভাবিক
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFontSizeChange("large")}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                      btFontSize === "large"
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    বড় (স্পষ্ট)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFontSizeChange("xlarge")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                      btFontSize === "xlarge"
                        ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    অনেক বড়
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                <span className="text-muted-foreground">প্রিন্ট মোড:</span>
                <div className="inline-flex rounded-md border border-border/60 bg-background p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handlePrintModeChange("canvas")}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      btPrintMode === "canvas"
                        ? "bg-primary/20 text-primary font-bold"
                        : "text-muted-foreground"
                    }`}
                    title="বাংলা ও ৳ সহ স্পষ্ট গ্রাফিক ভাউচার"
                  >
                    Graphic (বড় ও স্পষ্ট)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintModeChange("text")}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      btPrintMode === "text"
                        ? "bg-primary/20 text-primary font-bold"
                        : "text-muted-foreground"
                    }`}
                    title="দ্রুত হার্ডওয়্যার টেক্সট প্রিন্ট"
                  >
                    Text (দ্রুত)
                  </button>
                </div>
              </div>
            </div>

            {/* Voucher Preview */}
            <div className="rounded-lg border border-border bg-white text-black p-3 max-h-64 overflow-y-auto overflow-x-hidden shadow-inner flex justify-center">
              <div
                style={{
                  width: width === "A4" ? "100%" : width === "58" ? "260px" : "320px",
                  maxWidth: "100%",
                }}
              >
                <style>{css}</style>
                <div
                  className="due-voucher-preview-clone"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <Button
                type="button"
                onClick={handleBluetoothPrint}
                disabled={btPrinting}
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

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="h-9 rounded-xl text-xs cursor-pointer"
                >
                  বাতিল / Skip
                </Button>
                <Button
                  onClick={handleRegularPrint}
                  variant="outline"
                  className="h-9 rounded-xl text-xs cursor-pointer gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" /> Regular Print
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BluetoothPrinterModal
        open={btModalOpen}
        onOpenChange={setBtModalOpen}
        businessName={voucher.business?.name || "Sheikh Pharma"}
      />
    </>
  );
}
