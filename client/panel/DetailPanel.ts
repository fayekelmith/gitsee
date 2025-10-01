import * as d3 from "d3";
import { PanelContent, PanelSection } from "./types.js";

export class DetailPanel {
  private panel!: d3.Selection<HTMLDivElement, unknown, HTMLElement, unknown>;
  private contentContainer!: d3.Selection<
    HTMLDivElement,
    unknown,
    HTMLElement,
    unknown
  >;
  private isVisible: boolean = false;
  private container: HTMLElement;

  constructor(container?: HTMLElement) {
    this.container = container || document.body;
    this.createPanel();
    this.injectStyles();
  }

  private createPanel(): void {
    // Ensure container has relative positioning
    if (this.container !== document.body) {
      d3.select(this.container).style("position", "relative");
    }

    // Create the floating panel
    this.panel = d3
      .select(this.container)
      .append("div")
      .attr("class", "gitsee-detail-panel")
      .style("position", "absolute")
      .style("top", "20px")
      .style("left", "20px")
      .style("width", "300px")
      .style("max-height", this.container === document.body ? "calc(100vh - 40px)" : "calc(100% - 40px)")
      .style("background", "#21262d")
      .style("border", "1px solid #30363d")
      .style("border-radius", "8px")
      .style("box-shadow", "0 8px 24px rgba(0, 0, 0, 0.4)")
      .style("z-index", "1000")
      .style("transform", "translateX(-120%)")
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
      .on("mouseover", function () {
        d3.select(this)
          .style("background", "#30363d")
          .style("color", "#e6edf3");
      })
      .on("mouseout", function () {
        d3.select(this)
          .style("background", "transparent")
          .style("color", "#7d8590");
      })
      .on("click", () => {
        this.hide();
      });

    // Add content container with scroll
    this.contentContainer = this.panel
      .append("div")
      .attr("class", "panel-content")
      .style("padding", "20px")
      .style("overflow-y", "auto")
      .style("max-height", "100%");
  }

  public updateContent(content: PanelContent): void {
    // Clear existing content
    this.contentContainer.selectAll("*").remove();

    // Add header with node name
    const header = this.contentContainer
      .append("div")
      .attr("class", "node-header")
      .style("margin-bottom", "20px");

    // Check if this content has an avatar (from node data)
    const hasAvatar = content.avatar;

    if (hasAvatar) {
      // Create header with avatar and name side by side
      const headerFlex = header
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "12px");

      // Add avatar
      headerFlex
        .append("img")
        .attr("src", content.avatar as string)
        .attr("alt", `${content.name} avatar`)
        .style("width", "40px")
        .style("height", "40px")
        .style("border-radius", "50%")
        .style("border", "2px solid #30363d");

      // Add name
      headerFlex
        .append("h2")
        .style("margin", "0")
        .style("color", "#e6edf3")
        .style("font-size", "20px")
        .style("font-weight", "600")
        .style("font-family", "system-ui, -apple-system, sans-serif")
        .text(content.name);
    } else {
      // Regular header without avatar
      header
        .append("h2")
        .style("margin", "0 0 8px 0")
        .style("color", "#e6edf3")
        .style("font-size", "20px")
        .style("font-weight", "600")
        .style("font-family", "system-ui, -apple-system, sans-serif")
        .text(content.name);
    }

    // Render each section
    content.sections.forEach((section) => {
      this.renderSection(section);
    });
  }

  private renderSection(section: PanelSection): void {
    const sectionContainer = this.contentContainer
      .append("div")
      .attr("class", `section-${section.type}`)
      .style("margin-bottom", "20px");

    // Add section title
    sectionContainer
      .append("h3")
      .style("margin", "0 0 12px 0")
      .style("color", "#7d8590")
      .style("font-size", "14px")
      .style("font-weight", "600")
      .style("text-transform", "uppercase")
      .style("letter-spacing", "0.5px")
      .text(section.title);

    // Render section content based on type
    switch (section.type) {
      case "text":
        this.renderTextSection(sectionContainer, section.data);
        break;
      case "stats":
        this.renderStatsSection(sectionContainer, section.data);
        break;
      case "content":
        this.renderContentSection(sectionContainer, section.data);
        break;
    }
  }

  private renderTextSection(container: any, data: string): void {
    const textContainer = container
      .append("div")
      .style("margin", "0")
      .style("color", "#c9d1d9")
      .style("font-size", "14px")
      .style("line-height", "1.5")
      .style("font-family", "system-ui, -apple-system, sans-serif");

    // Check if data contains HTML tags, if so use innerHTML, otherwise use text
    if (data.includes("<") && data.includes(">")) {
      textContainer.node().innerHTML = data;
    } else {
      textContainer.text(data);
    }
  }

  private renderStatsSection(container: any, stats: any[]): void {
    const statsGrid = container
      .append("div")
      .style("display", "grid")
      .style("grid-template-columns", "1fr 1fr")
      .style("gap", "12px");

    stats.forEach((stat) => {
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
  }

  private renderContentSection(container: any, data: string): void {
    container
      .append("pre")
      .style("margin", "0")
      .style("padding", "12px")
      .style("background", "#161b22")
      .style("border", "1px solid #30363d")
      .style("border-radius", "6px")
      .style("color", "#c9d1d9")
      .style("font-size", "12px")
      .style("line-height", "1.4")
      .style("font-family", "monospace")
      .style("white-space", "pre-wrap")
      .style("word-wrap", "break-word")
      .style("max-height", "400px")
      .style("overflow-y", "auto")
      .text(data);
  }

  private injectStyles(): void {
    // Check if styles are already injected
    if (document.getElementById("gitsee-panel-styles")) return;

    const styleSheet = document.createElement("style");
    styleSheet.id = "gitsee-panel-styles";
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
    this.panel.style("transform", "translateX(0)");
  }

  public hide(): void {
    this.isVisible = false;
    this.panel.style("transform", "translateX(-120%)");
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
    const styleSheet = document.getElementById("gitsee-panel-styles");
    if (styleSheet) {
      styleSheet.remove();
    }
  }
}
