# SFM Prompt Templates & Validators

GPT prompt templates for generating Seesaw-compatible JSON outputs, with runtime validators for cognitive quality assurance.

## Structure

```
sfm-prompts/
├── GPT_PROMPT_PD_v5.md          # Latest: PD prompt with Cognitive Provenance Layer
├── GPT_PROMPT_PD_v4.md          # PD prompt with banned words list
├── GPT_PROMPT_PD_v3.md          # PD prompt with parentId + stage language fixes
├── validators/
│   └── pd_validator.py          # 8 runtime validators for PD output
└── tests/
    ├── test_pd03_v3_output.json # v3 output (5 errors — مركزي, آلياً)
    ├── test_pd04_v4_output.json # v4 output (0 errors, no provenance)
    └── test_pd05_provenance.json # v5 output (0 errors, with provenance)
```

## Usage

### 1. Generate PD JSON
Copy the prompt from `GPT_PROMPT_PD_v5.md` into ChatGPT, provide a pain story, get JSON output.

### 2. Validate
```bash
python3 sfm-prompts/validators/pd_validator.py output.json
```

### 3. Expected Output
```
✅ PD_VALID
Passed: 25/25  Warnings: 0  Errors: 0
```

## Validators (8 total)

| # | Validator | Checks |
|---|-----------|--------|
| 1 | `node-structure` | parentId, extent, required node types, group ID naming |
| 2 | `anti-solution` | Banned words (نظام, مركزي, آلي, واجهة, platform, automated...) |
| 3 | `stage-language` | Solution hints in signals, technical language in goals |
| 4 | `scope-drift` | inScope contains features instead of outcomes |
| 5 | `gate-consistency` | Gate approved with open unknowns |
| 6 | `invented-numbers` | Percentages not from the pain story |
| 7 | `boundary-questions` | Unknowns missing governance questions |
| 8 | `provenance` | Cognitive Provenance Layer metadata validation |

## Version History

- **v3**: parentId fix, Insight language, boundary questions
- **v4**: Banned words list (KILLER RULE #8), 24/24 validator pass
- **v5**: Cognitive Provenance Layer — source, confidence, derived_from, validation_status, reasoning
