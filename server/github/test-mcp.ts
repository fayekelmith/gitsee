import { RepoAnalyzer } from "./repo-analyzer/index.js";
import { config } from "dotenv";

config();

async function testContributorPRs() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error("GITHUB_TOKEN environment variable is required");
    process.exit(1);
  }

  const analyzer = new RepoAnalyzer({
    githubToken: token,
  });

  const user = "Evanfeenstra";
  try {
    const output = await analyzer.getContributorPRs(
      "stakwork",
      "hive",
      user,
      5
    );
    console.log(output);
  } catch (error) {
    console.error("Error fetching contributor PRs:", error);
    process.exit(1);
  }
}

testContributorPRs();
