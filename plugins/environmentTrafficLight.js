var plugin = {
  metadataVersion: "1.0.0",
  id: "environment-traffic-light",
  name: "Environment Traffic Light",
  version: "1.0.0",
  author: "Aman Anand",
  email: "contact@amananand.in",
  website: "https://amananand.in",
  description: "Adds a colored safety header. Supports multiple keywords (comma-separated).",

  settings: {
    info: {
      text: "This plugin is pre-configured with defaults. You can add custom keywords below (comma-separated).",
      type: "label",
    },
    prod_keywords: {
      text: "Production Keywords (Red)",
      type: "textinput",
      scope: "browser",
      default: "prod, production, prd, live",
    },
    test_keywords: {
      text: "Test/QA Keywords (Orange)",
      type: "textinput",
      scope: "browser",
      default: "test, tst, qa, quality, uat, stage, staging, pre-prod",
    },
    dev_keywords: {
      text: "Development Keywords (Green)",
      type: "textinput",
      scope: "browser",
      default: "dev, development, sandbox, sbx, poc, demo",
    },
  },

  heartbeat: async (pluginHelper, settings) => {
    // --- SMART INPUT READER (The Fix) ---
    // This function handles the "environment-traffic-light---" prefix automatically.
    const getList = (keyName, fallback) => {
      const pluginId = "environment-traffic-light";
      const prefixedKey = `${pluginId}---${keyName}`;

      // 1. Try finding the value with the prefix (e.g., environment-traffic-light---prod_keywords)
      // 2. If not found, try the normal key (prod_keywords)
      // 3. If neither exists, use the fallback default
      let raw = settings[prefixedKey];
      if (raw === undefined) raw = settings[keyName];
      if (raw === undefined) raw = fallback;

      return raw
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 0);
    };

    // 1. Get Lists using the Key Name (string) instead of the variable
    const listProd = getList("prod_keywords", "prod, production, prd, live");
    const listTest = getList("test_keywords", "test, tst, qa, quality, uat, stage, staging, pre-prod");
    const listDev = getList("dev_keywords", "dev, development, sandbox, sbx, poc, demo");

    // 2. Matcher Logic (Domain Only)
    const checkMatch = (keywordList) => {
      const currentDomain = window.location.hostname.toLowerCase();
      return keywordList.some((k) => currentDomain.includes(k));
    };

    // 3. Define Environments (Priority: Prod > Test > Dev)
    const environments = [
      {
        type: "PROD",
        isMatch: checkMatch(listProd),
        color: "#8B0000", // Dark Red
        text: "⚠ PRODUCTION ENVIRONMENT",
      },
      {
        type: "TEST",
        isMatch: checkMatch(listTest),
        color: "#D35400", // Orange
        text: "TEST / QA SYSTEM",
      },
      {
        type: "DEV",
        isMatch: checkMatch(listDev),
        color: "#218c54", // Green
        text: "DEVELOPMENT / SANDBOX",
      },
    ];

    // Find the FIRST match
    const activeEnv = environments.find((env) => env.isMatch);

    const barId = "cpi-helper-top-injector-bar";
    let bar = document.getElementById(barId);
    const shell = document.getElementById("shell") || document.querySelector(".sapUshellShell") || document.body;

    // 4. Logic: No Match -> Reset
    if (!activeEnv) {
      if (bar) bar.remove();
      if (shell && shell.id === "shell") {
        shell.style.top = "";
        shell.style.height = "";
      } else {
        document.body.style.marginTop = "";
      }
      return;
    }

    // 5. Logic: Match Found -> Render
    if (!bar) {
      bar = document.createElement("div");
      bar.id = barId;
      Object.assign(bar.style, {
        width: "100%",
        height: "25px",
        textAlign: "center",
        lineHeight: "25px",
        fontSize: "12px",
        fontWeight: "bold",
        letterSpacing: "1px",
        position: "fixed",
        top: "0",
        left: "0",
        zIndex: "999999",
        boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
        color: "white",
      });
      bar.style.backgroundColor = activeEnv.color;
      bar.innerText = activeEnv.text;
      document.body.appendChild(bar);

      // Push Content Down
      if (shell && shell.id === "shell") {
        shell.style.top = "25px";
        shell.style.position = "absolute";
        shell.style.height = "calc(100% - 25px)";
        shell.style.boxSizing = "border-box";
      } else {
        document.body.style.marginTop = "25px";
      }
    } else {
      // Update existing bar
      if (bar.innerText !== activeEnv.text || bar.style.backgroundColor !== activeEnv.color) {
        bar.style.backgroundColor = activeEnv.color;
        bar.innerText = activeEnv.text;
      }
      // Enforce Push
      if (shell && shell.id === "shell" && shell.style.top !== "25px") {
        shell.style.top = "25px";
        shell.style.height = "calc(100% - 25px)";
      }
    }
  },
};

pluginList.push(plugin);
