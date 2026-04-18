# TC Plants Blog Setup - Eleventy + GitHub Pages

## Quick Start (Run These Commands)

```bash
# 1. Create new repo
git clone https://github.com/Phyto-Evolution/tcplants-blog.git
cd tcplants-blog

# 2. Initialize Node project
npm init -y

# 3. Install Eleventy
npm install --save-dev @11ty/eleventy markdown-it

# 4. Create structure
mkdir -p src/posts src/media src/_includes src/css
touch .eleventy.js .gitignore

# 5. Create GitHub Pages deployment config
```

## File: .eleventy.js

```javascript
module.exports = function(eleventyConfig) {
  // Input/output directories
  return {
    dir: {
      input: "src",
      output: "_output"
    },
    templateFormats: ["md", "html"],
    markdownTemplateEngine: "html"
  };
};
```

## File: src/_data/site.js

```javascript
module.exports = {
  title: "TC Plants Lab Journal",
  description: "Daily tissue culture observations",
  url: "https://tcplants-blog.github.io",
  repository: "Phyto-Evolution/tcplants-blog"
};
```

## File: src/_includes/base.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title }} - {{ site.title }}</title>
  <link rel="stylesheet" href="/css/main.css">
</head>
<body>
  <header class="blog-header">
    <h1>🌿 {{ site.title }}</h1>
  </header>
  <main class="blog-content">
    {{ content | safe }}
  </main>
</body>
</html>
```

## File: src/css/main.css (Apollo Theme - Stripped)

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg: #0d1117;
  --sf: #161b22;
  --bd: #30363d;
  --tx: #e6edf3;
  --ac: #58a6ff;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  background: var(--bg);
  color: var(--tx);
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.6;
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.blog-header {
  padding: 20px 0;
  border-bottom: 1px solid var(--bd);
  margin-bottom: 30px;
}

.blog-header h1 {
  font-size: 28px;
  font-weight: 700;
}

.blog-content {
  display: grid;
  gap: 20px;
}

.blog-post {
  padding: 20px;
  background: var(--sf);
  border: 1px solid var(--bd);
  border-radius: 8px;
}

.post-meta {
  font-size: 13px;
  color: #8b949e;
  margin-bottom: 12px;
}

.post-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--ac);
}

.post-tags {
  display: flex;
  gap: 6px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.tag {
  display: inline-block;
  padding: 4px 10px;
  background: var(--bd);
  border-radius: 4px;
  font-size: 12px;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  margin: 12px 0;
}

code {
  background: var(--bd);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 13px;
}

pre {
  background: var(--bd);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 12px 0;
}

h2, h3, h4 {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
}
```

## File: package.json

```json
{
  "name": "tcplants-blog",
  "version": "1.0.0",
  "scripts": {
    "start": "eleventy --serve",
    "build": "eleventy",
    "deploy": "gh-pages -d _output"
  },
  "devDependencies": {
    "@11ty/eleventy": "^2.0.0",
    "markdown-it": "^13.0.0"
  }
}
```

## File: .github/workflows/build.yml (Auto-deploy)

```yaml
name: Build and Deploy

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm install
    - run: npm run build
    - uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./_output
```

## File: .gitignore

```
node_modules/
_output/
.env
```

## Sample Post: src/posts/2026-04-18-vanilla-transfer.md

```markdown
---
title: "Vanilla Transfer - Stage 3 to Stage 4"
date: 2026-04-18T14:30:00Z
timestamp: "2026-04-18-143000"
species: "Vanilla planifolia"
stage: "Stage 3"
status: "successful"
cultures_out: 45
tags: ["vanilla", "transfer", "stage3", "success"]
media: ["vanilla-stage3.jpg", "culture-transfer.jpg"]
linked_bottle_id: "bot-xyz123"
tc_plants_id: "note-abc123"
layout: base.html
---

## Observations
- Culture growth rate: excellent
- Media quality: good
- Contamination: none observed
- Color: healthy green

## Procedure
1. Sterilized instruments (70% ethanol, flame)
2. Transferred 45 cultures to new bottles
3. New medium: MS + 2 mg/L BAP
4. Total time: 45 minutes

## Photos
See attached: vanilla-stage3.jpg (before), culture-transfer.jpg (process)

## Next Review
April 25, 2026 (7 days)

## Notes
Growth rate excellent - continue current protocol.
```

## Deploy to GitHub Pages

```bash
# In repo settings:
# 1. Go to Settings → Pages
# 2. Source: Deploy from branch
# 3. Branch: gh-pages
# 4. Folder: /(root)
# 5. Save

# GitHub Actions will auto-build and deploy on every push to main
```

## TC Plants Integration Points

**In TC Plants app:**
```javascript
const LabBlog = {
  // Blog API endpoint (GitHub Pages)
  API_URL: 'https://api.github.com/repos/Phyto-Evolution/tcplants-blog/contents',
  PAGES_URL: 'https://tcplants-blog.github.io',
  
  // List all posts (fetch from GitHub)
  async listPosts(),
  
  // Create new post (write to GitHub)
  async createPost(title, markdown, species, tags),
  
  // Upload media (create in media folder)
  async uploadMedia(file, timestamp),
};
```

## That's it!

Eleventy builds static HTML from markdown → GitHub Pages serves it → TC Plants app embeds it in an iframe or fetches the JSON list.

**Next step**: Implement LabBlog module in TC Plants index.html to:
- Fetch blog post listing
- Render in "Lab Journal" section
- Create new posts
- Upload media

