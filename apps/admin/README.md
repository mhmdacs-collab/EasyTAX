# EasyTAX Admin Portal (Phase 1)

تطبيق إداري مستقل داخل المونوربو لإدارة الاشتراكات.

## تشغيل محلي

```bash
pnpm --filter @easytax/admin dev
```

اضبط `VITE_API_URL` إلى عنوان الـAPI (مثال: `http://localhost:3000`).

## أمان دخول المدراء

بوابة الإدارة لا تحتوي تسجيل عام. الدخول يتم فقط عبر Better Auth، ثم تحقق دور المدير من جدول `admin_users` في قاعدة البيانات.

## إنشاء أول حساب مدير بشكل آمن

1. أنشئ/استخدم حساب Better Auth عادي (لا يوجد تسجيل عام داخل admin app).
2. احصل على `user_id` من جدول `user` في قاعدة البيانات:

```sql
SELECT id, email FROM "user" WHERE email = 'admin@example.com';
```

3. امنح صلاحية الإدارة بإدراج `user_id` في `admin_users`:

```sql
INSERT INTO admin_users (user_id) VALUES ('<USER_ID>');
```

بعدها فقط يصبح هذا المستخدم قادراً على الوصول إلى `/api/v1/admin/*` وصفحات الإدارة.
