# ৬ মাসের পুরোনো ডাটা vault-এ archive + সাথে সাথে লাইভ দেখা

## এখন যা আছে
- ছবি/ফাইল (product image, attachments) ইতিমধ্যে সরাসরি vault-এ যায়।
- ব্যাকআপ: ডাটাবেস ৩০০ MB পার হলে ব্যাকআপ ফাইল vault-এ যায়, restore করা যায়।
- rx.sheikhpharma.shop ও pt.sheikhpharma.shop একই অ্যাপ, তাই সব নিয়ম ওখানেও একই সাথে চলবে।

## যা বানাবো
1. **Auto archive**: ডাটাবেস ৩০০ MB পার হলে প্রতিদিনের কাজে ৬ মাসের বেশি পুরোনো রেকর্ড (বিক্রি/কেনা বিল ও লাইন, পেমেন্ট, প্রেসক্রিপশন ও লাইন, ল্যাব রিপোর্ট, সিরিয়াল, খরচ) মাস অনুযায়ী ফাইল বানিয়ে vault-এ রাখবে, তারপর ডাটাবেস থেকে মুছবে। স্টক/হিসাবের ব্যালান্স ঠিক রাখতে মোট সংখ্যা আগে থেকেই সংরক্ষিত থাকবে।
2. **সাথে সাথে লাইভ দেখা**: বিক্রি তালিকা, রিপোর্ট, রোগীর প্রেসক্রিপশন/ল্যাব ইতিহাসে পুরোনো তারিখ বা ইনভয়েস নম্বর খুঁজলে অ্যাপ নিজে vault থেকে ফাইল এনে সাথে সাথে দেখাবে (restore লাগবে না)। একবার আনা ফাইল অল্প সময়ের জন্য cache থাকবে, তাই দ্বিতীয়বার দ্রুত।
3. **সূচি**: কোন মাস কোন vault ফাইলে আছে তার ছোট একটি তালিকা ডাটাবেসে থাকবে, যাতে ইনভয়েস নম্বর/রোগীর ফোন দিয়ে ঠিক ফাইলটি খোঁজা যায়।
4. **Admin Backups পেজে**: archive হওয়া মাসগুলোর তালিকা, সাইজ, আর "এখনই archive চালাও" বাটন; চাইলে কোনো মাস পুরো ডাটাবেসে ফেরতও আনা যাবে।
5. **pos.qweekbd.com**: কোড কিছু লাগবে না। Domain card দিয়ে connect করতে হবে (আপনি এবার বন্ধ করেছেন; পরে বললে আবার দেখাব)। DNS-এ `pos` নামে A record `185.158.133.1` আর `_lovable.pos` TXT লাগবে।

## সীমাবদ্ধতা
- archive করা ডাটা শুধু দেখা/প্রিন্ট করা যাবে; এডিট/ডিলিট করতে হলে আগে মাসটি ফেরত আনতে হবে।
- পুরোনো ডাটা খুললে vault-এর গতির উপর নির্ভর করে ১-৩ সেকেন্ড লাগতে পারে।

## Technical
- নতুন টেবিল `archive_chunks(business_id, table_name, period_month, vault_file_id, row_count, bytes, key_index jsonb)` + GRANT/RLS (business member read)।
- `archive.server.ts`: threshold চেক (`backup_db_size`), মাসভিত্তিক gzip JSON upload, `key_index`-এ invoice_no/phone/id, সফল upload যাচাই শেষে batch delete।
- `archive.functions.ts`: `fetchArchived({table, from, to, key})` — vault download, in-memory TTL cache, live রেকর্ডের সাথে merge।
- বিদ্যমান backup cron route-এ archive ধাপ যোগ; list query-গুলোতে তারিখ ৬ মাসের পুরোনো হলে archived fetch যুক্ত।
