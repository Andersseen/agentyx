---
"@agentyx/core": patch
---

Fix a local Skill directory escape: a `SKILL.md` that is itself a symlink pointing outside its
configured skill directory is now rejected with `LocalSkillDirectoryError` instead of being read
and parsed. The directory containing each skill was already verified real; the file inside it was
not.
