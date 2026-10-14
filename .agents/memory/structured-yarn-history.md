---
name: Structured yarn history
description: Preserve earlier free-text yarn details while new projects use structured brand, type, and color fields.
---

New project records store yarn Brand, Type, and Color separately. Existing free-text yarn values remain unchanged and should stay visible as prior notes; do not infer which pieces are brand, type, or color.

**Why:** Legacy yarn strings are ambiguous, and splitting them risks changing the user's intended data.

**How to apply:** When changing project forms or migrating yarn fields, preserve and display legacy text unless the user explicitly asks to convert or remove it.
