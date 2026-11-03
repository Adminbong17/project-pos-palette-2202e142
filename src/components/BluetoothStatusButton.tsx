import { useState, useEffect } from "react";
import { thermalPrinter, type ConnectedPrinterInfo } from "@/lib/bluetooth-printer";
import { BluetoothPrinterModal } from "@/components/BluetoothPrinterModal";
import { Bluetooth } from "lucide-react";

export function BluetoothStatusButton({
  className = "",
  showText = true,
  businessName = "Sheikh Pharma",
}: {
  className?: string;
  showText?: boolean;
  businessName?: string;
}) {
  const [printer, setPrinter] = useState<ConnectedPrinterInfo | null>(thermalPrinter.getConnectedPrinter());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return thermalPrinter.subscribe(setPrinter);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold cursor-pointer transition-colors ${
          printer
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
            : "border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200 hover:bg-blue-500/20"
        } ${className}`}
        title={printer ? `সংযুক্ত প্রিন্টার: ${printer.name} (ক্লিক করে সেটিংস দেখুন)` : "58mm ব্লুটুথ থার্মাল প্রিন্টার কানেক্ট করুন (PT-220)"}
      >
        <Bluetooth className="h-3.5 w-3.5 text-blue-600 shrink-0" />
        {showText && (
          <>
            <span className="hidden sm:inline">
              {printer ? printer.name : "ব্লুটুথ প্রিন্টার"}
            </span>
            <span className="sm:hidden">
              {printer ? "প্রিন্টার" : "BT"}
            </span>
          </>
        )}
        {printer && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
      </button>

      <BluetoothPrinterModal
        open={open}
        onOpenChange={setOpen}
        businessName={businessName}
      />
    </>
  );
}
