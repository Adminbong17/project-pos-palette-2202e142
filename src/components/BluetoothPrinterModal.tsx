import { useState, useEffect } from "react";
import { thermalPrinter, type ConnectedPrinterInfo } from "@/lib/bluetooth-printer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bluetooth, Printer, CheckCircle2, AlertCircle, RefreshCw, Zap, X } from "lucide-react";
import { toast } from "sonner";

interface BluetoothPrinterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessName?: string;
}

export function BluetoothPrinterModal({
  open,
  onOpenChange,
  businessName = "Sheikh Pharma",
}: BluetoothPrinterModalProps) {
  const [printer, setPrinter] = useState<ConnectedPrinterInfo | null>(thermalPrinter.getConnectedPrinter());
  const [loading, setLoading] = useState(false);
  const [autoPrint, setAutoPrint] = useState<boolean>(() => {
    return localStorage.getItem("pos_auto_bt_print") === "true";
  });

  useEffect(() => {
    return thermalPrinter.subscribe((info) => {
      setPrinter(info);
    });
  }, []);

  const handleToggleAutoPrint = (checked: boolean) => {
    setAutoPrint(checked);
    localStorage.setItem("pos_auto_bt_print", checked ? "true" : "false");
    toast.success(checked ? "সেল কনফার্ম হলে অটো ব্লুটুথ প্রিন্ট অন করা হয়েছে" : "অটো ব্লুটুথ প্রিন্ট বন্ধ করা হয়েছে");
  };

  const handleConnectBle = async () => {
    setLoading(true);
    try {
      const res = await thermalPrinter.connectBluetooth();
      toast.success(`ব্লুটুথ প্রিন্টার কানেক্ট হয়েছে: ${res.name}`);
    } catch (err: any) {
      if (err.name !== "NotFoundError") {
        toast.error(err.message || "কানেক্ট করতে সমস্যা হয়েছে");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectSerial = async () => {
    setLoading(true);
    try {
      const res = await thermalPrinter.connectSerial(115200);
      toast.success(`ব্লুটুথ সিরিয়াল কানেক্ট হয়েছে: ${res.name}`);
    } catch (err: any) {
      if (err.name !== "NotFoundError") {
        toast.error(err.message || "কানেক্ট করতে সমস্যা হয়েছে");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await thermalPrinter.disconnect();
    toast.info("প্রিন্টার ডিসকানেক্ট করা হয়েছে");
  };

  const handleTestPrint = async () => {
    setLoading(true);
    try {
      await thermalPrinter.printTestSlip(businessName);
      toast.success("টেস্ট রসিদ সফলভাবে প্রিন্ট হয়েছে!");
    } catch (err: any) {
      toast.error(err.message || "টেস্ট প্রিন্ট ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border-border p-6 shadow-2xl">
        <DialogHeader className="border-b border-border/60 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Bluetooth className="h-5 w-5 text-blue-500 animate-pulse" />
            <span>58mm ওয়্যারলেস থার্মাল প্রিন্টার (Bluetooth)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Connection Status Box */}
          <div
            className={`rounded-xl border p-4 transition-all ${
              printer
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
                : "border-border bg-muted/40 text-foreground"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {printer ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <div>
                  <div className="text-sm font-bold">
                    {printer ? printer.name : "কোনো প্রিন্টার সংযুক্ত নেই"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {printer
                      ? `কানেকশন মোড: ${printer.type === "bluetooth" ? "Web Bluetooth (BLE)" : "Bluetooth Serial (COM)"}`
                      : "তার ও ড্রাইভার ছাড়া ব্লুটুথ দিয়ে রসিদ প্রিন্ট করুন"}
                  </div>
                </div>
              </div>
              {printer && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDisconnect}
                  className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  ডিসকানেক্ট
                </Button>
              )}
            </div>
          </div>

          {/* Quick Setup Instructions */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-muted-foreground space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-blue-600" />
              <span>সহজ কানেকশন গাইড (PT-220_73D4):</span>
            </div>
            <p>
              ১. প্রিন্টারের পাওয়ার অন রাখুন এবং পিসির ব্লুটুথ চালু রাখুন।<br />
              ২. <b>Web Bluetooth</b> দিয়ে সরাসরি ব্রাউজারে ডিভাইস সিলেক্ট করুন।<br />
              ৩. অথবা Windows Bluetooth-এ প্রিন্টারটি পেয়ার করে (PIN: <b>0000</b>) <b>Bluetooth COM</b> সিলেক্ট করুন।
            </p>
          </div>

          {/* Connect Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={handleConnectBle}
              className="h-11 rounded-xl border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-900 dark:text-blue-200 text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Bluetooth className="h-4 w-4 text-blue-600" />
              <span>Web Bluetooth (BLE)</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={handleConnectSerial}
              className="h-11 rounded-xl border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-900 dark:text-purple-200 text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Printer className="h-4 w-4 text-purple-600" />
              <span>Bluetooth COM / USB</span>
            </Button>
          </div>

          {/* Auto-Print Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card p-3 shadow-2xs">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-foreground">
                অটো প্রিন্ট (Auto-Print after Sale)
              </div>
              <div className="text-[11px] text-muted-foreground">
                POS-এ সেল সম্পন্ন হওয়ার সাথে সাথে স্বয়ংক্রিয়ভাবে রসিদ বের হবে
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => handleToggleAutoPrint(e.target.checked)}
              className="h-4 w-4 rounded accent-primary cursor-pointer"
            />
          </div>

          {/* Test Print Button */}
          {printer && (
            <Button
              type="button"
              variant="default"
              disabled={loading}
              onClick={handleTestPrint}
              className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-sm"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              <span>টেস্ট রসিদ প্রিন্ট করুন (Test Print)</span>
            </Button>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full h-9 rounded-xl text-xs"
          >
            বন্ধ করুন
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
