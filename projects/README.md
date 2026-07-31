# SFM Projects — PD Outputs

مخرجات مرحلة PD (Problem Discovery) لكل مشروع. جاهزة للاستيراد في seesaw.sillar.us.

## الهيكل

```
projects/
└── {project_name}/
    └── {project_name}_pd_{version}_{timestamp}.json
```

## الفحص

```bash
python3 sfm-prompts/validators/pd_validator.py projects/dental_clinic/dental_clinic_pd_v4_*.json
```
