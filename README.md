# GitSee

Interactive repository visualization library with D3.js.

![Screenshot](screenshot.png)

## Usage

### Client-Side

```html
<div id="viz" style="width: 800px; height: 600px;"></div>
<script type="module">
  import { GitVisualizer } from "./dist/index.js";

  const viz = new GitVisualizer("#viz");
  viz.visualizeRepository("owner/repo-name");
</script>
```

### Server-Side API

```bash
# Start server
yarn dev

# Get repository data (POST request)
curl -X POST http://localhost:3000/api/gitsee \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "stakwork",
    "repo": "gitsee",
    "data": ["repo_info", "contributors", "stats", "files"]
  }'
```

### Environment

```bash
# .env
GITHUB_TOKEN=your_token
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_key
```

## Framework Integration

### React

```jsx
function RepoViz({ owner, repo }) {
  const ref = useRef();

  useEffect(() => {
    const viz = new GitVisualizer(ref.current);
    viz.visualizeRepository(`${owner}/${repo}`);
    return () => viz.destroy();
  }, [owner, repo]);

  return <div ref={ref} style={{ width: "100%", height: "600px" }} />;
}
```
