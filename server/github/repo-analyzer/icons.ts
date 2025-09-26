import { BaseAnalyzer } from "../base.js";

export class IconAnalyzer extends BaseAnalyzer {
  async getRepoIcon(owner: string, repo: string): Promise<string | null> {
    try {
      // Get root directory contents
      const rootContents = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: "",
      });

      if (!Array.isArray(rootContents.data)) {
        return null;
      }

      // Look for icon files in root
      const iconFiles = rootContents.data.filter((file: any) => {
        const name = file.name.toLowerCase();
        return (
          name.includes("favicon") ||
          name.includes("logo") ||
          name.includes("icon") ||
          (name.startsWith("apple-touch") && name.includes("icon"))
        );
      });

      // Check common subdirectories
      const subdirs = ["public", "assets", "static", "images", "img"];
      for (const subdir of subdirs) {
        const subdirExists = rootContents.data.find(
          (item: any) => item.name === subdir && item.type === "dir",
        );

        if (subdirExists) {
          try {
            const subdirContents = await this.octokit.rest.repos.getContent({
              owner,
              repo,
              path: subdir,
            });

            if (Array.isArray(subdirContents.data)) {
              const subdirIcons = subdirContents.data.filter((file: any) => {
                const name = file.name.toLowerCase();
                return (
                  name.includes("favicon") ||
                  name.includes("logo") ||
                  name.includes("icon")
                );
              });
              iconFiles.push(
                ...subdirIcons.map((f: any) => ({
                  ...f,
                  path: `${subdir}/${f.name}`,
                })),
              );
            }
          } catch (error) {
            continue;
          }
        }
      }

      // Sort by resolution (highest first)
      const sortedIcons = this.sortIconsByResolution(iconFiles);

      // Try to fetch the best icon
      for (const iconFile of sortedIcons) {
        const filePath = iconFile.path || iconFile.name;

        try {
          const iconResponse = await this.octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath,
          });

          if ("content" in iconResponse.data && iconResponse.data.content) {
            const iconData = `data:image/png;base64,${iconResponse.data.content}`;
            return iconData;
          }
        } catch (error) {
          continue;
        }
      }

      return null;
    } catch (error: any) {
      console.error(`💥 Error fetching repo icon for ${owner}/${repo}:`, error.message);
      return null;
    }
  }

  private sortIconsByResolution(iconFiles: any[]): any[] {
    return iconFiles.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      const getResolution = (name: string) => {
        const match = name.match(/(\d+)x\d+/);
        if (match) return parseInt(match[1]);

        if (name.includes("512")) return 512;
        if (name.includes("256")) return 256;
        if (name.includes("192")) return 192;
        if (name.includes("180")) return 180;
        if (name.includes("apple-touch")) return 180;
        if (name.includes("android-chrome")) return 192;
        if (name === "favicon.ico") return 64;
        if (name.includes("logo")) return 100;

        return 50;
      };

      return getResolution(bName) - getResolution(aName); // Higher first
    });
  }
}