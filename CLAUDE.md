### you are building a repository visualization tool!

You can edit files and run commands without my confirmation!

When you are done with a task, run "yarn build" so you can see if there are any errors to fix!

Then run "afplay /System/Library/Sounds/Ping.aiff" so I can hear that its ready for review!

### guidance

Please try to modularize things so its maintainable in the future. We are building a real product here... avoid mock code! But don't worry about backward compatibility for now, its still early. Feel free to delete deprecated code when you write more up-to-date implementations.

IMPORTANT: try to keep things clean and simple.

IMPORTANT: try to follow existing patterns in the codebase.

## Architecture Overview

### Core Classes

#### Client-Side (`/client/`)

**`GitVisualizer`** - Main orchestrator class (index.ts)

- Creates and manages the D3.js visualization canvas
- Handles API communication and data fetching
- Coordinates timing and animations between different visualization layers
- Manages the detail panel system

**Visualization Resources** (`/client/resources/`)

- **`RepositoryVisualization`** - Renders the central repository node with avatar/icon
- **`ContributorsVisualization`** - Creates contributor nodes with avatars and contribution counts
- **`FilesVisualization`** - Displays key files (package.json, README, etc.) with click-to-view content
- **`StatsVisualization`** - Shows repository statistics as interactive boxes (stars, PRs, commits, age)
- **`LinksVisualization`** - Draws connecting lines between related nodes

**Panel System** (`/client/panel/`)

- **`DetailPanel`** - Floating side panel for detailed node information
- Supports different content types: text, stats grids, and syntax-highlighted code
- Dynamic content loading with GitHub API integration for file contents

#### Server-Side (`/server/`)

**`GitSeeHandler`** - Main API request processor

- Orchestrates data fetching from multiple GitHub endpoints
- Handles caching, rate limiting, and error management
- Supports configurable authentication and private repository access

**Resource Modules** (`/server/resources/`)

- **`RepositoryResource`** - Fetches basic repository information
- **`ContributorsResource`** - Gets contributor data with avatar URLs
- **`FilesResource`** - Discovers key files and fetches their contents
- **`StatsResource`** - Calculates repository statistics (PRs, commits, age)
- **`IconsResource`** - Retrieves repository avatars and organization icons

**Utilities**

- **`GitSeeCache`** - Intelligent caching system with TTL support
- **`RepoCloner`** - Background repository cloning for advanced analysis

### Data Flow

1. **`GitVisualizer`** makes API request to **`GitSeeHandler`**
2. **Handler** coordinates **Resource** modules to fetch GitHub data
3. **Client** receives data and creates **Visualization** instances
4. **Visualizations** render nodes with organic positioning and collision detection
5. **User clicks** trigger **DetailPanel** with dynamic content loading

PLEASE UPDATE THIS FILE WHEN YOU CREATE A NEW CORE CLASS!

### future plans:

- use github listCommits with file "path" to create edges between contributors and files
