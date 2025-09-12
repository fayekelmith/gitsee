import { BaseResource } from "./base.js";

export class IconsResource extends BaseResource {
  async getRepoIcon(owner: string, repo: string): Promise<string | null> {
    // Check cache first (null is a valid cached value)
    const cached = await this.getCached<string | null>(owner, repo, "icon");
    if (cached !== undefined) {
      console.log(
        `💾 Cache hit for ${owner}/${repo} icon:`,
        cached ? "Found" : "Not found"
      );
      console.log(`🔄 Clearing cache to retry (checking for rate limits)...`);
      this.cache.clear(); // Clear cache to retry
      // Don't return cached, let it retry
    }

    console.log(`🚀 Starting fresh icon fetch for ${owner}/${repo}`);

    try {
      // Get root directory contents
      console.log(`📁 Getting root contents for ${owner}/${repo}...`);
      const rootContents = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: "",
      });

      if (!Array.isArray(rootContents.data)) {
        console.log(`❌ Root contents not an array`);
        this.setCached(owner, repo, "icon", null);
        return null;
      }

      console.log(`📂 Found ${rootContents.data.length} files in root`);
      // console.log(`📂 Root files:`, rootContents.data.map((f: any) => f.name).slice(0, 10));

      // Look for icon files in root
      const iconFiles = rootContents.data.filter((file: any) => {
        const name = file.name.toLowerCase();
        const isIcon =
          name.includes("favicon") ||
          name.includes("logo") ||
          name.includes("icon") ||
          (name.startsWith("apple-touch") && name.includes("icon"));
        if (isIcon) {
          console.log(`🎯 Found potential icon in root: ${file.name}`);
        }
        return isIcon;
      });

      console.log(`📊 Found ${iconFiles.length} icon files in root`);

      // Check common subdirectories
      const subdirs = ["public", "assets", "static", "images", "img"];
      for (const subdir of subdirs) {
        const subdirExists = rootContents.data.find(
          (item: any) => item.name === subdir && item.type === "dir"
        );

        if (subdirExists) {
          console.log(`📂 Checking ${subdir}/ directory...`);
          try {
            const subdirContents = await this.octokit.rest.repos.getContent({
              owner,
              repo,
              path: subdir,
            });

            if (Array.isArray(subdirContents.data)) {
              // console.log(
              //   `📂 ${subdir}/ contents:`,
              //   subdirContents.data.map((f: any) => f.name)
              // );

              const subdirIcons = subdirContents.data.filter((file: any) => {
                const name = file.name.toLowerCase();
                const isIcon =
                  name.includes("favicon") ||
                  name.includes("logo") ||
                  name.includes("icon");
                if (isIcon) {
                  console.log(
                    `🎯 Found potential icon in ${subdir}/: ${file.name}`
                  );
                }
                return isIcon;
              });
              iconFiles.push(
                ...subdirIcons.map((f: any) => ({
                  ...f,
                  path: `${subdir}/${f.name}`,
                }))
              );
            }
          } catch (error) {
            console.log(`⚠️  Could not access ${subdir}/ directory`);
            continue;
          }
        }
      }

      console.log(`📊 Total icon files found: ${iconFiles.length}`);

      // Sort by resolution (highest first)
      const sortedIcons = this.sortIconsByResolution(iconFiles);
      console.log(
        "🏆 Sorted icon priority:",
        sortedIcons.map((f) => f.path || f.name)
      );

      // Try to fetch the best icon
      for (const iconFile of sortedIcons) {
        const filePath = iconFile.path || iconFile.name;
        console.log(`📥 Attempting to fetch: ${filePath}`);

        try {
          const iconResponse = await this.octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath,
          });

          if ("content" in iconResponse.data && iconResponse.data.content) {
            const iconData = `data:image/png;base64,${iconResponse.data.content}`;
            console.log(`✅ Successfully loaded icon: ${filePath}`);
            console.log(`📊 Icon data length: ${iconData.length} chars`);

            // Cache the result
            this.setCached(owner, repo, "icon", iconData);
            return iconData;
          } else {
            console.log(`❌ No content in response for: ${filePath}`);
          }
        } catch (error) {
          console.log(`❌ Failed to load: ${filePath}`);
          continue;
        }
      }

      console.log("❌ No icons could be loaded");
      this.setCached(owner, repo, "icon", null);
      return null;
    } catch (error: any) {
      console.error(`💥 ERROR fetching repo icon for ${owner}/${repo}:`, error);

      // Check if it's a rate limit error
      if (error.status === 403 || error.message?.includes("rate limit")) {
        console.error(`⏱️  RATE LIMIT HIT! Error:`, error.message);
        console.error(`🔑 Using token:`, !!this.octokit.auth);
      }

      this.setCached(owner, repo, "icon", null);
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
