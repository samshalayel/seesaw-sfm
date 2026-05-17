# SFM Projects — PD Outputs

مخرجات مرحلة PD (Problem Discovery) لكل مشروع.

## الهيكل

```
projects/
├── {project_name}/
│   ├── {project_name}_pd_{version}_{timestamp}.json   ← PD output
│   └── ...
└── README.md
```

## الاستخدام

### 1. توليد الناتج
```
GPT_PROMPT_PD_v5.md → ChatGPT → JSON output
```

### 2. فحص بالـ Validator
```bash
python3 sfm-prompts/validators/pd_validator.py projects/dental_clinic/dental_clinic_pd_v5_2026-05-17T10-57-51Z.json
```

### 3. استيراد في المنصة
- اذهب إلى [seesaw.sillar.us](https://seesaw.sillar.us)
- Import → paste JSON

### 4. التعديل
- عدّل الملف مباشرة في الريبو
- أو عدّل على المنصة وصدّر JSON محدّث
- أعد تشغيل الـ validator بعد أي تعديل

## الملفات الحالية

| ملف | النسخة | الحالة |
|-----|--------|--------|
| `dental_clinic_pd_v2_*` | v2 | أول ناتج ناجح |
| `dental_clinic_pd_v3_*` | v3 | 5 errors (مركزي, آلياً) |
| `dental_clinic_pd_v4_*` | v4 | 100% PD_VALID |
| `dental_clinic_pd_v5_*` | v5 | 2 errors (نظام), no provenance |
