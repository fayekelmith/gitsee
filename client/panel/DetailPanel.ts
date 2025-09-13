import * as d3 from "d3";

export class DetailPanel {
  private panel: d3.Selection<HTMLDivElement, unknown, HTMLElement, unknown>;
  private isVisible: boolean = false;

  constructor() {
    this.createPanel();
    this.injectStyles();
  }

  private createPanel(): void {
    // Create the floating panel
    this.panel = d3.select("body")
      .append("div")
      .attr("class", "gitsee-detail-panel")
      .style("position", "fixed")
      .style("top", "20px")
      .style("left", "20px")
      .style("width", "300px")
      .style("max-height", "calc(100vh - 40px)")
      .style("background", "#21262d")
      .style("border", "1px solid #30363d")
      .style("border-radius", "8px")
      .style("box-shadow", "0 8px 24px rgba(0, 0, 0, 0.4)")
      .style("z-index", "1000")
      .style("transform", "translateX(-100%)")
      .style("transition", "transform 0.3s ease")
      .style("overflow", "hidden");

    // Add close button
    this.panel
      .append("button")
      .attr("class", "close-button")
      .style("position", "absolute")
      .style("top", "12px")
      .style("right", "12px")
      .style("width", "24px")
      .style("height", "24px")
      .style("border", "none")
      .style("background", "transparent")
      .style("color", "#7d8590")
      .style("cursor", "pointer")
      .style("border-radius", "4px")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("font-size", "16px")
      .style("line-height", "1")
      .style("transition", "all 0.2s ease")
      .text("×")
      .on("mouseover", function() {
        d3.select(this)
          .style("background", "#30363d")
          .style("color", "#e6edf3");
      })
      .on("mouseout", function() {
        d3.select(this)
          .style("background", "transparent")
          .style("color", "#7d8590");
      })
      .on("click", () => {
        this.hide();
      });

    // Add content container with scroll
    const content = this.panel
      .append("div")
      .attr("class", "panel-content")
      .style("padding", "20px")
      .style("overflow-y", "auto")
      .style("max-height", "100%");

    // Add hardcoded content
    this.addHardcodedContent(content);
  }

  private addHardcodedContent(container: d3.Selection<HTMLDivElement, unknown, HTMLElement, unknown>): void {
    // Repository header
    const header = container
      .append("div")
      .attr("class", "repo-header")
      .style("margin-bottom", "20px");

    // Repo name
    header
      .append("h2")
      .style("margin", "0 0 8px 0")
      .style("color", "#e6edf3")
      .style("font-size", "20px")
      .style("font-weight", "600")
      .style("font-family", "system-ui, -apple-system, sans-serif")
      .text("stakwork/gitsee");

    // Stats section
    const statsContainer = container
      .append("div")
      .attr("class", "stats-section")
      .style("margin-bottom", "20px");

    statsContainer
      .append("h3")
      .style("margin", "0 0 12px 0")
      .style("color", "#7d8590")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .style("text-transform", "uppercase")
      .style("letter-spacing", "0.5px")
      .text("Statistics");

    // Stats grid
    const statsGrid = statsContainer
      .append("div")
      .style("display", "grid")
      .style("grid-template-columns", "1fr 1fr")
      .style("gap", "12px");

    // Individual stats
    const stats = [
      { label: "Stars", value: "2", icon: "⭐" },
      { label: "PRs", value: "3", icon: "🔄" },
      { label: "Commits", value: "23", icon: "📝" },
      { label: "Age", value: "2y", icon: "📅" }
    ];

    stats.forEach(stat => {
      const statItem = statsGrid
        .append("div")
        .style("background", "#161b22")
        .style("border", "1px solid #30363d")
        .style("border-radius", "6px")
        .style("padding", "12px")
        .style("text-align", "center");

      statItem
        .append("div")
        .style("font-size", "11px")
        .style("margin-bottom", "4px")
        .text(`${stat.icon} ${stat.value}`);

      statItem
        .append("div")
        .style("font-size", "10px")
        .style("color", "#7d8590")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "0.5px")
        .text(stat.label);
    });

    // Description section
    const descContainer = container
      .append("div")
      .attr("class", "description-section");

    descContainer
      .append("h3")
      .style("margin", "0 0 12px 0")
      .style("color", "#7d8590")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .style("text-transform", "uppercase")
      .style("letter-spacing", "0.5px")
      .text("Description");

    descContainer
      .append("p")
      .style("margin", "0")
      .style("color", "#c9d1d9")
      .style("font-size", "14px")
      .style("line-height", "1.5")
      .style("font-family", "system-ui, -apple-system, sans-serif")
      .text("Interactive repository visualization library built with D3.js and TypeScript. Features organic node positioning, real-time GitHub API integration, and beautiful hover effects. Designed to be embeddable in any web application with zero configuration. This is a longer description to test scrolling functionality when content exceeds the panel height. The panel should automatically show a scrollbar when needed while maintaining its floating appearance and responsive design.");
  }

  private injectStyles(): void {
    // Check if styles are already injected
    if (document.getElementById('gitsee-panel-styles')) return;
    
    const styleSheet = document.createElement('style');
    styleSheet.id = 'gitsee-panel-styles';
    styleSheet.textContent = `
      .gitsee-detail-panel {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      
      .gitsee-detail-panel::-webkit-scrollbar {
        width: 6px;
      }
      
      .gitsee-detail-panel::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .gitsee-detail-panel::-webkit-scrollbar-thumb {
        background: #484f58;
        border-radius: 3px;
      }
      
      .gitsee-detail-panel::-webkit-scrollbar-thumb:hover {
        background: #5a6169;
      }
      
      .panel-content::-webkit-scrollbar {
        width: 6px;
      }
      
      .panel-content::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .panel-content::-webkit-scrollbar-thumb {
        background: #484f58;
        border-radius: 3px;
      }
      
      .panel-content::-webkit-scrollbar-thumb:hover {
        background: #5a6169;
      }
    `;
    document.head.appendChild(styleSheet);
  }

  public show(): void {
    this.isVisible = true;
    this.panel
      .style("transform", "translateX(0)");
  }

  public hide(): void {
    this.isVisible = false;
    this.panel
      .style("transform", "translateX(-100%)");
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public destroy(): void {
    this.panel.remove();
    
    // Remove injected styles if no other instances exist
    const styleSheet = document.getElementById('gitsee-panel-styles');
    if (styleSheet) {
      styleSheet.remove();
    }
  }
}