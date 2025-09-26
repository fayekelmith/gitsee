import { BaseAnalyzer } from "../base.js";
import {
  FileInfo,
  FileContent,
} from "../types.js";

export class FileAnalyzer extends BaseAnalyzer {
  async getKeyFiles(owner: string, repo: string): Promise<FileInfo[]> {
    // Comprehensive list of key files to check for
    const candidateFiles = [
      // Package managers
      { name: "package.json", type: "package" as const },
      { name: "Cargo.toml", type: "package" as const },
      { name: "go.mod", type: "package" as const },
      { name: "setup.py", type: "package" as const },
      { name: "requirements.txt", type: "package" as const },
      { name: "pyproject.toml", type: "package" as const },
      { name: "pom.xml", type: "package" as const },
      { name: "build.gradle", type: "package" as const },
      { name: "build.gradle.kts", type: "package" as const },
      { name: "composer.json", type: "package" as const },
      { name: "Gemfile", type: "package" as const },
      { name: "pubspec.yaml", type: "package" as const },

      // Documentation
      { name: "README.md", type: "docs" as const },
      { name: "readme.md", type: "docs" as const },
      { name: "README.txt", type: "docs" as const },
      { name: "README.rst", type: "docs" as const },
      { name: "ARCHITECTURE.md", type: "docs" as const },
      { name: "CONTRIBUTING.md", type: "docs" as const },
      { name: "ROADMAP.md", type: "docs" as const },
      { name: "API.md", type: "docs" as const },
      { name: "CLAUDE.md", type: "docs" as const },
      { name: "AGENTS.md", type: "docs" as const },

      // Configuration files
      { name: ".env.example", type: "config" as const },

      // Database & schemas
      { name: "prisma/schema.prisma", type: "data" as const },
      { name: "schema.prisma", type: "data" as const },
      { name: "schema.sql", type: "data" as const },
      { name: "migrations.sql", type: "data" as const },
      { name: "seeds.sql", type: "data" as const },

      // Docker & deployment
      { name: "Dockerfile", type: "build" as const },
      { name: "docker-compose.yml", type: "build" as const },
      { name: "docker-compose.yaml", type: "build" as const },
      { name: "Makefile", type: "build" as const },
      { name: "justfile", type: "build" as const },
      { name: "CMakeLists.txt", type: "build" as const },

      // Other important files
      { name: "LICENSE", type: "other" as const },
      { name: "LICENSE.md", type: "other" as const },
      { name: "LICENSE.txt", type: "other" as const },
      { name: "CODEOWNERS", type: "other" as const },
      { name: ".github/CODEOWNERS", type: "other" as const },
    ];

    const foundFiles: FileInfo[] = [];

    // Check all candidate files in parallel for much faster execution
    const fileCheckPromises = candidateFiles.map(async (candidate) => {
      try {
        await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path: candidate.name,
        });

        return {
          name: candidate.name,
          path: candidate.name,
          type: candidate.type,
        };
      } catch (error: any) {
        // File doesn't exist - that's fine, return null
        if (error.status !== 404) {
          console.warn(`⚠️ Error checking ${candidate.name}:`, error.message);
        }
        return null;
      }
    });

    // Wait for all checks to complete and filter out null results
    const results = await Promise.all(fileCheckPromises);
    foundFiles.push(...results.filter((file) => file !== null));

    return foundFiles;
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
  ): Promise<FileContent | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      // Handle the case where response.data is an array (directory) - we only want files
      if (Array.isArray(response.data)) {
        console.warn(`⚠️ Path ${path} is a directory, not a file`);
        return null;
      }

      const fileData = response.data as any;

      // Ensure it's a file and not a symlink or submodule
      if (fileData.type !== "file") {
        console.warn(`⚠️ Path ${path} is not a file (type: ${fileData.type})`);
        return null;
      }

      // Decode base64 content
      let content = "";
      if (fileData.encoding === "base64" && fileData.content) {
        content = Buffer.from(fileData.content, "base64").toString("utf-8");
      } else if (fileData.content) {
        content = fileData.content;
      }

      const fileContent: FileContent = {
        name: fileData.name,
        path: fileData.path,
        content: content,
        encoding: fileData.encoding || "utf-8",
        size: fileData.size || 0,
      };

      return fileContent;
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`❌ File not found: ${path}`);
        return null;
      }

      console.error(
        `💥 Error fetching file content for ${path}:`,
        error.message,
      );
      return null;
    }
  }
}