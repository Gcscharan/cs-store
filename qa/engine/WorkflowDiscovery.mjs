#!/usr/bin/env node
/**
 * Workflow Discovery Engine
 * Automatically discovers screens, buttons, forms, and actions
 * Generates WORKFLOW_MAP.json for autonomous testing
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class WorkflowDiscovery {
  constructor(engine) {
    this.engine = engine;
    this.discoveredScreens = new Map();
    this.discoveredFlows = new Map();
    this.workflowMap = {
      screens: {},
      flows: {},
      buttons: {},
      forms: {},
      navigation: {},
    };
  }

  async discoverScreen(screenName, url) {
    console.log(`🔍 Discovering screen: ${screenName}`);
    
    await this.engine.navigate(url);
    await this.engine.page.waitForTimeout(1000);
    
    const elements = await this.engine.discoverElements();
    const screenData = {
      url,
      name: screenName,
      buttons: elements.buttons,
      links: elements.links,
      inputs: elements.inputs,
      forms: elements.forms,
      headings: elements.headings,
      timestamp: Date.now(),
    };
    
    this.discoveredScreens.set(screenName, screenData);
    this.workflowMap.screens[screenName] = screenData;
    
    console.log(`✅ Discovered ${elements.buttons.length} buttons, ${elements.links.length} links`);
    return screenData;
  }

  async discoverAllScreens(manifest) {
    console.log("🔍 Starting comprehensive screen discovery...\n");
    
    for (const [category, data] of Object.entries(manifest.categories)) {
      console.log(`\n📂 ${category.toUpperCase()}`);
      
      for (const page of data.pages) {
        if (page.path.includes(":")) {
          console.log(`   ⏭️  Skipping parameterized route: ${page.name}`);
          continue;
        }
        
        const screenName = `${category}_${page.name.replace(/\s+/g, "_").toLowerCase()}`;
        await this.discoverScreen(screenName, page.path);
        await this.discoverButtonActions(screenName);
        await this.discoverFormActions(screenName);
      }
    }
    
    return this.workflowMap;
  }

  async discoverButtonActions(screenName) {
    const screenData = this.discoveredScreens.get(screenName);
    if (!screenData) {
      console.log(`⚠️  Screen not found: ${screenName}`);
      return [];
    }
    
    const actions = [];
    
    for (const btn of screenData.buttons) {
      if (btn.text && btn.text.length > 0 && !btn.disabled) {
        actions.push({
          type: "click",
          element: "button",
          text: btn.text,
          selector: btn.selector,
          screen: screenName,
        });
      }
    }
    
    for (const link of screenData.links) {
      if (link.text && link.text.length > 0) {
        actions.push({
          type: "navigate",
          element: "link",
          text: link.text,
          href: link.href,
          selector: link.selector,
          screen: screenName,
        });
      }
    }
    
    this.workflowMap.buttons[screenName] = actions;
    return actions;
  }

  async discoverFormActions(screenName) {
    const screenData = this.discoveredScreens.get(screenName);
    if (!screenData) return [];
    
    const forms = [];
    
    for (const form of screenData.forms) {
      const inputs = screenData.inputs.filter(
        (input) => input.selector.includes(form.selector.split(":")[0])
      );
      
      forms.push({
        selector: form.selector,
        action: form.action,
        method: form.method,
        inputs: inputs,
        screen: screenName,
      });
    }
    
    this.workflowMap.forms[screenName] = forms;
    return forms;
  }

  async discoverNavigationFlow(fromScreen, toScreen) {
    const fromData = this.discoveredScreens.get(fromScreen);
    const toData = this.discoveredScreens.get(toScreen);
    
    if (!fromData || !toData) return null;
    
    const flow = {
      from: fromScreen,
      to: toScreen,
      possiblePaths: [],
    };
    
    // Find links that navigate to the target
    for (const link of fromData.links) {
      if (link.href === toData.url || link.href.includes(toData.url)) {
        flow.possiblePaths.push({
          type: "link",
          selector: link.selector,
          text: link.text,
        });
      }
    }
    
    this.workflowMap.navigation[`${fromScreen}→${toScreen}`] = flow;
    return flow;
  }

  async generateWorkflowMap(outputPath) {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    fs.writeFileSync(outputPath, JSON.stringify(this.workflowMap, null, 2));
    console.log(`\n✅ Workflow map saved to: ${outputPath}`);
    
    // Print summary
    console.log("\n📊 Discovery Summary:");
    console.log(`   Screens: ${Object.keys(this.workflowMap.screens).length}`);
    console.log(`   Buttons discovered: ${Object.keys(this.workflowMap.buttons).length}`);
    console.log(`   Forms discovered: ${Object.keys(this.workflowMap.forms).length}`);
    console.log(`   Navigation paths: ${Object.keys(this.workflowMap.navigation).length}`);
    
    return this.workflowMap;
  }

  async loadWorkflowMap(inputPath) {
    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Workflow map not found: ${inputPath}`);
      return null;
    }
    
    const data = fs.readFileSync(inputPath, "utf-8");
    this.workflowMap = JSON.parse(data);
    console.log(`✅ Loaded workflow map from: ${inputPath}`);
    return this.workflowMap;
  }

  getActionsForScreen(screenName) {
    return this.workflowMap.buttons[screenName] || [];
  }

  getFormsForScreen(screenName) {
    return this.workflowMap.forms[screenName] || [];
  }

  getNavigationPath(fromScreen, toScreen) {
    return this.workflowMap.navigation[`${fromScreen}→${toScreen}`] || null;
  }

  getAllScreens() {
    return Object.keys(this.workflowMap.screens);
  }

  getScreenData(screenName) {
    return this.workflowMap.screens[screenName] || null;
  }
}

export default WorkflowDiscovery;
