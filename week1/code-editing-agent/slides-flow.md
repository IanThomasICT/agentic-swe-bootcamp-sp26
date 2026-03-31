## Main idea

Demonstrate the progression of the building of this coding agent with side-by-side Typescript, and Go code snippets. 

### Style

- Use `slidev` for slideshow
- Title (task) + Side-by-side code snippets.
- Smoothly transition the changed code so it's obvious to the users where the code changes.
- Style the changed code slightly differently to visually indicate the changed state. 

### Slides sequence

1. Overview of article
2. Pseudocode + transitions from each step (start, list tool, read tool, edit tool)
3. Recommendations (anthropic -> openai, ANTHROPIC_API_KEY -> OPENROUTER_API_KEY) + transitions to show diff between article snippets and our Go snippets
4. Walthrough (side-by-side Typescript and Go) + transitions for each step (start, list tool, read tool, edit tool) 
5. Bonus! (Adding an AGENTS.md file, System Prompt, Outputting thinking, and local session storage / resume)