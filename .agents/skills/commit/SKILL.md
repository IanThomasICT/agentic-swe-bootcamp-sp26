---
name: commit
description: Commit current changes with conventional
  commit format. Use after completing any task.
---

Commit the current changes following these rules:

1. Stage only files related to the current task
2. Write a commit message using conventional commit format
3. Keep the subject line under 85 characters
4. Add a Jira tag if working on a tracked issue
5. Never commit .env files, credentials, or secrets
6. Commit as the author: "Ian's Agent <agent@ianthomas.com>"