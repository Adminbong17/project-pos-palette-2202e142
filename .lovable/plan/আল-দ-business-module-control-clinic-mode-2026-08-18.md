# আলাদা Business, Module control, Clinic mode

## এখন যা আছে (উত্তর)

- আলাদা business আছে ৩টা: **Sheikh pharma** (6 জন), **Pubali Shop** (1), **Bashundhara** (1)। এদের data সম্পূর্ণ আলাদা, কিন্তু সুপার অ্যাডমিনের জন্য এদের এক জায়গায় দেখার/মডিউল বদলানোর কোনো পেজ নেই — তাই "কোথায়" প্রশ্নটা আসছে।
- Doctor/Assistant সবাই এখনো Sheikh pharma-র ভেতরে আছে (Iqbal Hasan, Mehedi Hasan + ২ জন assistant)।
- Module পরে বদলানোর কোনো UI নেই — শুধু approve করার সময় একবার সেট হয়।

## যা বানানো হবে

### 1. Businesses & Modules পেজ (super admin only) — `/admin/businesses`
- সব business-এর কার্ড: নাম, owner, ধরন (POS / Doctor / Clinic), member সংখ্যা।
- প্রতিটি member-এর পাশে module checkbox (POS, Sales, Products, Manufacturing, CRM, HRM, Repair, Restaurant, Prescriptions, Patient Queue, Reports, Settings…) — যেকোনো সময় টিক দিয়ে/তুলে **Save**। এটাই "পরে module যোগ করা"-র জায়গা।
- Business-level shortcut: "সব member-কে এই module গুলো দাও"।
- Doctor row-এ "নিজের আলাদা business-এ সরাও" বাটন।

### 2. ডাক্তার/অ্যাসিস্ট্যান্টকে Sheikh pharma থেকে আলাদা করা
- নতুন SQL function `move_doctor_to_own_business`: ডাক্তারের নামে নতুন business (clinic_mode=false, Doctor ধরন) তৈরি করে ডাক্তার + তার assistant-দের সরায়, সাথে তার clinical data (chambers, staff, appointments, prescriptions, presets, option settings) নতুন business-এ move করে। POS/inventory data ছোঁয়া হয় না।
- Iqbal Hasan ও Mehedi Hasan-কে এই ভাবে আলাদা করা হবে (assistant সহ)।
- এরপর থেকে Doctor request approve করলে ডিফল্টভাবেই তার নিজের business তৈরি হবে — Sheikh pharma-র অধীনে নয়।

### 3. Assistant-দের তার ডাক্তারের নিচে দেখানো
- `/admin/doctors` এবং `/rx-staff` — প্রতিটি ডাক্তারের কার্ডের ভেতরে তার assistant-দের তালিকা (নাম, chamber, ফোন), যাদের কোনো ডাক্তার নেই তারা "Unassigned" গ্রুপে।

### 4. Sign up-এ Clinic যোগ
- Sign up ড্রপডাউনে তিনটি অপশন: Doctor / Clinic / Shop staff (POS)। Clinic নিলে clinic নাম ও ঠিকানা চাওয়া হবে।
- Approve করলে `clinic_mode = true` নতুন business তৈরি হয়, role **Clinic Admin**, module শুধু: Clinic Dashboard, Prescriptions (view), Patient Queue, My Staff।

### 5. Clinic যা করতে পারবে
- **ডাক্তার যোগ** — clinic-এর ভেতরে ডাক্তার অ্যাকাউন্ট তৈরি (নাম, qualification, ফোন, login + password)।
- **ডাক্তারের নিচে assistant যোগ** — প্রতিটি ডাক্তার বেছে chamber সহ assistant তৈরি।
- **সিরিয়াল নেওয়া** — Patient Queue-তে appointment/token।
- Clinic নিজে prescription লিখতে বা POS/inventory ব্যবহার করতে পারবে না।

## কৌশলগত বিবরণ

- Migration-এ: `move_doctor_to_own_business(_user_id uuid)` ও `approve_access_request_clinic(_id, _clinic_name, _sections)` — দুটোই SECURITY DEFINER, শুধু super admin চালাতে পারবে; `businesses` টেবিলে `biz_kind text` (pos/doctor/clinic) কলাম যোগ।
- `provision_rx_staff`-এর পাশে নতুন `provision_clinic_doctor(...)` — clinic admin-এর জন্য Doctor role সহ অ্যাকাউন্ট তৈরি।
- Frontend: নতুন `src/routes/_authenticated/admin.businesses.tsx`, নতুন `src/routes/_authenticated/clinic-doctors.tsx`, আর `admin.doctors.tsx` / `rx-staff.tsx` / `auth.tsx` / `use-allowed-sections.ts` / sidebar আপডেট।
