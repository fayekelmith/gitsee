Usage example:

```ts
import { RepoAnalyzer } from "./lib/index.js";

const analyzer = new RepoAnalyzer({ githubToken: process.env.GITHUB_TOKEN });

// Get Alice's recent work
const commits = await analyzer.getContributorCommits(
  "stakwork",
  "hive",
  "Evanfeenstra",
  10
);
const files = await analyzer.getContributorFiles(
  "stakwork",
  "hive",
  "Evanfeenstra",
  5
);
const prs = await analyzer.getContributorPRs(
  "stakwork",
  "hive",
  "Evanfeenstra",
  5
);

// Get recent activity
const recentCommits = await analyzer.getRecentCommits("stakwork", "hive", {
  days: 7,
});
```
